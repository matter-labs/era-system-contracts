// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract MockContract {
    event Called(uint256 value, bytes data);

    struct Result {
        bool failure;
        bytes returnData;
    }

    // The mapping from calldata to call result, will return empty return data with successful result by default.
    mapping(bytes => Result) results;

    // This function call will not pass to fallback, but this is fine for the tests.
    function setResult(bytes calldata _calldata, Result calldata result) external {
        results[_calldata] = result;
    }

    fallback() external payable {
        uint256 len;
        assembly {
            len := calldatasize()
        }
        bytes memory data = new bytes(len);
        assembly {
            calldatacopy(add(data, 0x20), 0, len)
        }

        bool failure = results[data].failure;
        bytes memory returnData = results[data].returnData;

        // Most likely that's some call to perform some action, so context is not static.
        if (!failure && returnData.length == 0) {
            emit Called(msg.value, data);
        }
        assembly {
            switch failure
            case 0 {
                return(add(returnData, 0x20), mload(returnData))
            }
            default {
                revert(add(returnData, 0x20), mload(returnData))
            }
        }
    }
}
