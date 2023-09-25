// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

uint8 constant OPERATION_BITMASK = 7;

uint8 constant LENGTH_BITS_OFFSET = 3;

interface ICompressor {
    function publishCompressedBytecode(
        bytes calldata _bytecode,
        bytes calldata _rawCompressedData
    ) external payable returns (bytes32 bytecodeHash);

    function verifyCompressedStateDiffs(
        uint256 _numberOfStateDiffs,
        uint256 _enumerationIndexSize,
        bytes calldata _stateDiffs,
        bytes calldata _compressedStateDiffs
    ) external payable returns (bytes32 stateDiffHash);
}
