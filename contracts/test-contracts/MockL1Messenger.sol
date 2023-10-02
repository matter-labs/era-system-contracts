// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract MockL1Messenger {
    event MockBytecodeL1Published(bytes32 indexed bytecodeHash);

    function requestBytecodeL1Publication(bytes32 _bytecodeHash) external {
        emit MockBytecodeL1Published(_bytecodeHash);
    }
}
