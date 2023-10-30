// SPDX-License-Identifier: MIT

pragma solidity0 .8 .20;

contract DummyUpgrade {
    event Upgraded();

    function performUpgrade() public {
        emit Upgraded();
    }
}
