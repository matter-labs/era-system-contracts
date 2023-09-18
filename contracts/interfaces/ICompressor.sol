// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ICompressor {
    function publishCompressedBytecode(
        bytes calldata _bytecode,
        bytes calldata _rawCompressedData
    ) external payable returns (bytes32 bytecodeHash);

    function verifyCompressedStateDiffs(
        uint256 _numberOfStateDiffs,
        bytes calldata _stateDiffs,
        bytes calldata _compressedStateDiffs
    ) external payable returns (bytes32 stateDiffHash);
}
