// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/ICompressor.sol";
import "./interfaces/ISystemContract.sol";
import "./Constants.sol";
import "./libraries/Utils.sol";
import "./libraries/UnsafeBytesCalldata.sol";

/**
 * @author Matter Labs
 * @notice Contract with code pertaining to compression for zkEVM; at the moment this is used for bytecode compression
 * and state diff compression validation.
 * @dev Every deployed bytecode/published state diffs in zkEVM should be publicly restorable from the L1 data availability.
 * For this reason, the user may request the sequencer to publish the original bytecode and mark it as known.
 * Or the user may compress the bytecode and publish it instead (fewer data onchain!). At the end of every L1 Batch
 * we publish pubdata, part of which contains the state diffs that occurred within the batch.
 */
contract Compressor is ICompressor, ISystemContract {
    using UnsafeBytesCalldata for bytes;

    /// @notice Verify the compressed bytecode and publish it on the L1.
    /// @param _bytecode The original bytecode to be verified against.
    /// @param _rawCompressedData The compressed bytecode in a format of:
    ///    - 2 bytes: the length of the dictionary
    ///    - N bytes: the dictionary
    ///    - M bytes: the encoded data
    /// @dev The dictionary is a sequence of 8-byte chunks, each of them has the associated index.
    /// @dev The encoded data is a sequence of 2-byte chunks, each of them is an index of the dictionary.
    /// @dev The compression algorithm works as follows:
    ///     1. The original bytecode is split into 8-byte chunks.
    ///     Since the bytecode size is always a multiple of 32, this is always possible.
    ///     2. For each 8-byte chunk in the original bytecode:
    ///         * If the chunk is not already in the dictionary, it is added to the dictionary array.
    ///         * If the dictionary becomes overcrowded (2^16 + 1 elements), the compression process will fail.
    ///         * The 2-byte index of the chunk in the dictionary is added to the encoded data.
    /// @dev Currently, the method may be called only from the bootloader because the server is not ready to publish bytecodes
    /// in internal transactions. However, in the future, we will allow everyone to publish compressed bytecodes.
    function publishCompressedBytecode(
        bytes calldata _bytecode,
        bytes calldata _rawCompressedData
    ) external payable onlyCallFromBootloader returns (bytes32 bytecodeHash) {
        unchecked {
            (bytes calldata dictionary, bytes calldata encodedData) = _decodeRawBytecode(_rawCompressedData);

            require(dictionary.length % 8 == 0, "Dictionary length should be a multiple of 8");
            require(dictionary.length <= 2 ** 16 * 8, "Dictionary is too big");
            require(
                encodedData.length * 4 == _bytecode.length,
                "Encoded data length should be 4 times shorter than the original bytecode"
            );

            for (uint256 encodedDataPointer = 0; encodedDataPointer < encodedData.length; encodedDataPointer += 2) {
                uint256 indexOfEncodedChunk = uint256(encodedData.readUint16(encodedDataPointer)) * 8;
                require(indexOfEncodedChunk < dictionary.length, "Encoded chunk index is out of bounds");

                uint64 encodedChunk = dictionary.readUint64(indexOfEncodedChunk);
                uint64 realChunk = _bytecode.readUint64(encodedDataPointer * 4);

                require(encodedChunk == realChunk, "Encoded chunk does not match the original bytecode");
            }
        }

        bytecodeHash = Utils.hashL2Bytecode(_bytecode);
        L1_MESSENGER_CONTRACT.sendToL1(_rawCompressedData);
        KNOWN_CODE_STORAGE_CONTRACT.markBytecodeAsPublished(bytecodeHash);
    }

    /// @notice Verifies that the compression of state diffs has been done correctly for the {_stateDiffs} param.
    /// @param _numberOfStateDiffs The number of state diffs being checked.
    /// @param _stateDiffs Encoded full state diff structs. See the first dev comment below for encoding.
    /// @param _compressedStateDiffs The compressed state diffs
    /// @dev We don't verify that the size of {_stateDiffs} is equivalent to {_numberOfStateDiffs} * STATE_DIFF_ENTRY_SIZE since that check is
    ///      done within the L1Messenger calling contract.
    /// @return stateDiffHash Hash of the encoded (uncompressed) state diffs to be committed to via system log.
    /// @dev This check assumes that the ordering of state diffs in both {_stateDiffs} and {_compressedStateDiffs} are the same.
    /// @dev state diff:   [20bytes address][32bytes key][32bytes derived key][8bytes enum index][32bytes initial value][32bytes final value]
    /// @dev The compression format:
    ///     - 4 bytes: number of initial storage changes
    ///     - N bytes: initial storage changes
    ///     - M bytes: repeated storage changes
    /// @dev initial compressed diff: [32bytes derived key][32bytes final value]
    /// @dev repeated compressed diff: [8bytes enum index][32bytes final value]
    function verifyCompressedStateDiffs(
        uint256 _numberOfStateDiffs,
        uint256 _enumerationIndexSize,
        bytes calldata _stateDiffs,
        bytes calldata _compressedStateDiffs
    ) external payable onlyCallFrom(address(L1_MESSENGER_CONTRACT)) returns (bytes32 stateDiffHash) {
        uint256 numberOfInitialWrites = uint256(_compressedStateDiffs.readUint16(0));

        uint256 stateDiffPtr = 2;
        uint256 numInitialWritesProcessed = 0;

        // Process initial writes
        for (uint256 i = 0; i < _numberOfStateDiffs * STATE_DIFF_ENTRY_SIZE; i += STATE_DIFF_ENTRY_SIZE) {
            bytes calldata stateDiff = _stateDiffs[i:i + STATE_DIFF_ENTRY_SIZE];
            uint64 enumIndex = stateDiff.readUint64(84);

            if (enumIndex == 0) {
                numInitialWritesProcessed++;
                uint256 initValue = stateDiff.readUint256(92);
                uint256 finalValue = stateDiff.readUint256(124);
                bytes32 derivedKey = stateDiff.readBytes32(52);
                require(derivedKey == _compressedStateDiffs.readBytes32(stateDiffPtr), "iw: initial key mismatch");
                stateDiffPtr += 32;
                uint8 metadata = uint8(bytes1(_compressedStateDiffs[stateDiffPtr++]));
                uint8 operation = metadata & OPERATION_BITMASK;
                uint8 len = (metadata >> LENGTH_BITS_OFFSET) == 0 ? 32 : metadata >> LENGTH_BITS_OFFSET;
                _verifyValueCompression(
                    initValue,
                    finalValue,
                    operation,
                    _compressedStateDiffs[stateDiffPtr:stateDiffPtr + len]
                );
                stateDiffPtr += len;
            }
        }

        require(numInitialWritesProcessed == numberOfInitialWrites, "Incorrect number of initial storage diffs");

        // Process repeated writes
        for (uint256 i = 0; i < _numberOfStateDiffs * STATE_DIFF_ENTRY_SIZE; i += STATE_DIFF_ENTRY_SIZE) {
            bytes calldata stateDiff = _stateDiffs[i:i + STATE_DIFF_ENTRY_SIZE];
            uint64 enumIndex = stateDiff.readUint64(84);

            if (enumIndex > 0) {
                uint256 initValue = stateDiff.readUint256(92);
                uint256 finalValue = stateDiff.readUint256(124);
                require(enumIndex == _compressedStateDiffs.readUint32(stateDiffPtr), "rw: enum key mismatch");
                stateDiffPtr += _enumerationIndexSize;
                uint8 metadata = uint8(bytes1(_compressedStateDiffs[stateDiffPtr++]));
                uint8 operation = metadata & OPERATION_BITMASK;
                uint8 len = (metadata >> LENGTH_BITS_OFFSET) == 0 ? 32 : metadata >> LENGTH_BITS_OFFSET;
                _verifyValueCompression(
                    initValue,
                    finalValue,
                    operation,
                    _compressedStateDiffs[stateDiffPtr:stateDiffPtr + len]
                );
                stateDiffPtr += len;
            }
        }

        require(stateDiffPtr == _compressedStateDiffs.length, "Extra data in _compressedStateDiffs");

        stateDiffHash = EfficientCall.keccak(_stateDiffs);
    }

    /// @notice Decode the raw compressed data into the dictionary and the encoded data.
    /// @param _rawCompressedData The compressed bytecode in a format of:
    ///    - 2 bytes: the bytes length of the dictionary
    ///    - N bytes: the dictionary
    ///    - M bytes: the encoded data
    function _decodeRawBytecode(
        bytes calldata _rawCompressedData
    ) internal pure returns (bytes calldata dictionary, bytes calldata encodedData) {
        unchecked {
            // The dictionary length can't be more than 2^16, so it fits into 2 bytes.
            uint256 dictionaryLen = uint256(_rawCompressedData.readUint16(0));
            dictionary = _rawCompressedData[2:2 + dictionaryLen * 8];
            encodedData = _rawCompressedData[2 + dictionaryLen * 8:];
        }
    }

    // Operation id mapping:
    // 0 -> Nothing (32 bytes)
    // 1 -> Add
    // 2 -> Subtract
    // 3 -> Transform (< 32 bytes)
    function _verifyValueCompression(
        uint256 _initialValue,
        uint256 _finalValue,
        uint256 _operation,
        bytes calldata _compressedValue
    ) internal pure {
        uint256 convertedValue = uint256(bytes32(_compressedValue));
        convertedValue >>= (256 - (_compressedValue.length * 8));

        if (_operation == 0 || _operation == 3) {
            require(uint256(bytes32(_compressedValue)) == _finalValue);
        } else if (_operation == 1) {
            require(_initialValue + uint256(bytes32(_compressedValue)) == _finalValue);
        } else if (_operation == 2) {
            require(_initialValue - uint256(bytes32(_compressedValue)) == _finalValue);
        } else {
            revert("unsupported operation");
        }
    }
}
