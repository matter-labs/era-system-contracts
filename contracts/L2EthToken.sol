// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IL2StandardToken} from "./interfaces/IL2StandardToken.sol";
import {IEthToken} from "./interfaces/IEthToken.sol";
import {MSG_VALUE_SYSTEM_CONTRACT, DEPLOYER_SYSTEM_CONTRACT, BOOTLOADER_FORMAL_ADDRESS, L1_MESSENGER_CONTRACT} from "./Constants.sol";
import {SystemContractHelper} from "./libraries/SystemContractHelper.sol";
import {IMailbox} from "./interfaces/IMailbox.sol";

/**
 * @author Matter Labs
 * @notice Native ETH contract.
 * @dev It does NOT provide interfaces for personal interaction with tokens like `transfer`, `approve`, and `transferFrom`.
 * Instead, this contract is used by `MsgValueSimulator` and `ContractDeployer` system contracts
 * to perform the balance changes while simulating the `msg.value` Ethereum behavior.
 */
contract L2EthToken is IEthToken {
    /// @notice The balances of the users.
    mapping(address => uint256) balance;

    /// @notice The total amount of tokens that have been minted.
    uint256 public override totalSupply;

    /// NOTE: The deprecated from the previous upgrade storage variable.
    // TODO: Remove this variable with the new upgrade.
    address __DEPRECATED_l2Bridge = address(0);

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Callable only by the bootloader");
        _;
    }

    /// @notice Transfer tokens from one address to another.
    /// @param _from The address to transfer the ETH from.
    /// @param _to The address to transfer the ETH to.
    /// @param _amount The amount of ETH in wei being transferred.
    /// @dev This function can be called only by trusted system contracts.
    /// @dev This function also emits "Transfer" event, which might be removed
    /// later on.
    function transferFromTo(address _from, address _to, uint256 _amount) external override {
        require(
            msg.sender == MSG_VALUE_SYSTEM_CONTRACT ||
                msg.sender == address(DEPLOYER_SYSTEM_CONTRACT) ||
                msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only system contracts with special access can call this method"
        );

        // We rely on the compiler "Checked Arithmetic" to revert if the user does not have enough balance.
        balance[_from] -= _amount;
        balance[_to] += _amount;

        emit Transfer(_from, _to, _amount);
    }

    /// @notice Returns ETH balance of an account
    /// @dev It takes `uint256` as an argument to be able to properly simulate the behaviour of the
    /// Ethereum's `BALANCE` opcode that accepts uint256 as an argument and truncates any upper bits
    /// @param _account The address of the account to return the balance of.
    function balanceOf(uint256 _account) external view override returns (uint256) {
        return balance[address(uint160(_account))];
    }

    /// @notice Increase the total supply of tokens and balance of the receiver.
    /// @dev This method is only callable by the L2 ETH bridge.
    /// @param _account The address which to mint the funds to.
    /// @param _amount The amount of ETH in wei to be minted.
    function mint(address _account, uint256 _amount) external override onlyBootloader {
        totalSupply += _amount;
        balance[_account] += _amount;
        emit Mint(_account, _amount);
    }

    /// @notice Initiate the ETH withdrawal, funds will be available to claim on L1 `finalizeWithdrawal` method.
    /// @param _l1Receiver The address on L1 to receive the funds.
    function withdraw(address _l1Receiver) external payable override {
        uint256 amount = msg.value;

        // Silent burning of the ether
        unchecked {
            balance[address(this)] -= amount;
            totalSupply -= amount;
        }

        // Send the L2 log, a user could use it as proof of the withdrawal
        bytes memory message = _getL1WithdrawMessage(_l1Receiver, amount);
        L1_MESSENGER_CONTRACT.sendToL1(message);

        SystemContractHelper.toL1(true, bytes32(uint256(uint160(_l1Receiver))), bytes32(amount));
        emit Withdrawal(msg.sender, _l1Receiver, amount);
    }

    /// @dev Get the message to be sent to L1 to initiate a withdrawal.
    function _getL1WithdrawMessage(address _to, uint256 _amount) internal pure returns (bytes memory) {
        return abi.encodePacked(IMailbox.finalizeEthWithdrawal.selector, _to, _amount);
    }

    /// @dev This method has not been stabilized and might be
    /// removed later on.
    function name() external pure override returns (string memory) {
        return "Ether";
    }

    /// @dev This method has not been stabilized and might be
    /// removed later on.
    function symbol() external pure override returns (string memory) {
        return "ETH";
    }

    /// @dev This method has not been stabilized and might be
    /// removed later on.
    function decimals() external pure override returns (uint8) {
        return 18;
    }
}
