import { expect } from "chai";
import { ethers } from "hardhat";
import { Provider, Wallet } from "zksync-web3";
import { L2EthToken__factory, type L2EthToken } from "../typechain-types";
import type { L1Messenger } from "../typechain-types";
import { deployContract, deployContractOnAddress, getWallets } from "./shared/utils";
import * as hre from "hardhat";
import { BigNumber } from "ethers";
import {
    TEST_BOOTLOADER_FORMAL_ADDRESS, TEST_L1_MESSENGER_SYSTEM_CONTRACT_ADDRESS,
} from "./shared/constants";
import { getMock, prepareEnvironment, setResult } from "./shared/mocks";
describe("L2EthToken TEST", () => {
    let walletFrom: Wallet;
    let walletTo: Wallet;
    let l2EthToken: L2EthToken;
    let bootloaderAccount: ethers.Signer;


    beforeEach(async () => {
        await prepareEnvironment();
        walletFrom = getWallets()[0];
        walletTo = getWallets()[1];

        await deployContractOnAddress(TEST_L1_MESSENGER_SYSTEM_CONTRACT_ADDRESS, "L2EthToken");
        l2EthToken = L2EthToken__factory.connect(TEST_L1_MESSENGER_SYSTEM_CONTRACT_ADDRESS, walletFrom);

        // l2EthToken = (await deployContract("L2EthToken")) as L2EthToken;
        // l1Messenger = (await deployContract("L1Messenger")) as L1Messenger;
        bootloaderAccount = await ethers.getImpersonatedSigner(TEST_BOOTLOADER_FORMAL_ADDRESS);


    });

    // easywithdraw is simplified version of withdraw located in L2EthToken.sol
    // era-system-contracts/contracts/L2EthToken.sol:84
    it("should test easyWithdraw", async () => {
        const amountToWidthdraw = ethers.utils.parseEther("1.0");
        const message = ethers.utils.defaultAbiCoder.encode(["address"], [ethers.constants.AddressZero]);
        await setResult('L1Messenger', 'sendToL1', [message], {
            failure: false,
            returnData: ethers.utils.defaultAbiCoder.encode(
                ["bytes32"],
                [ethers.utils.keccak256(message)]
            ),
        });

        const gasPrice = await ethers.provider.getGasPrice();

        const tx = await l2EthToken.connect(walletFrom).easyWithdraw({ value: amountToWidthdraw, gasLimit: 5000000, gasPrice });
        console.log(tx);
        const result = await tx.wait();
        console.log(result);
    })
})