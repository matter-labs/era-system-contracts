import { expect } from "chai";
import { ethers } from "hardhat";
import { Provider, Wallet } from "zksync-web3";
import type { L2EthToken } from "../typechain-types";
import type { L1Messenger } from "../typechain-types";
import { deployContract, getWallets } from "./shared/utils";
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
        l2EthToken = (await deployContract("L2EthToken")) as L2EthToken;
        bootloaderAccount = await ethers.getImpersonatedSigner(TEST_BOOTLOADER_FORMAL_ADDRESS);

    });

    it("should mint and change balance and total supply", async () => {
        const initialSupply: BigNumber = await l2EthToken.totalSupply();
        const amountToMint = ethers.utils.parseEther("10.0");
        await expect(l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, amountToMint))
            .to.emit(l2EthToken, "Mint").withArgs(walletFrom.address, amountToMint);
        const finalSupply: BigNumber = await l2EthToken.totalSupply();
        const balanceOfWallet: BigNumber = await l2EthToken.balanceOf(walletFrom.address);

        expect(finalSupply).to.equal(initialSupply.add(amountToMint));
        expect(balanceOfWallet).to.equal(amountToMint);
    })

    it("should increase totalSupply and balance when minting tokens, also emit Mint", async () => {
        const initialSupply: BigNumber = await l2EthToken.totalSupply();
        const initialBalanceOfWallet: BigNumber = await l2EthToken.balanceOf(walletFrom.address);
        const amountToMint = ethers.utils.parseEther("10.0");

        await expect(l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, amountToMint))
            .to.emit(l2EthToken, "Mint").withArgs(walletFrom.address, amountToMint);

        const finalSupply: BigNumber = await l2EthToken.totalSupply();
        const balanceOfWallet: BigNumber = await l2EthToken.balanceOf(walletFrom.address);

        expect(finalSupply).to.equal(initialSupply.add(amountToMint));
        expect(balanceOfWallet).to.equal(initialBalanceOfWallet.add(amountToMint));
    });


    it("should tranfer successfully", async () => {
        await l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, ethers.utils.parseEther("100.0"));

        const senderBalandeBeforeTransfer: BigNumber = await l2EthToken.balanceOf(walletFrom.address);
        const recipientBalanceBeforeTransfer: BigNumber = await l2EthToken.balanceOf(walletTo.address);

        const amountToTransfer = ethers.utils.parseEther("10.0");

        await expect(l2EthToken.connect(bootloaderAccount).transferFromTo(walletFrom.address, walletTo.address, amountToTransfer))
            .to.emit(l2EthToken, "Transfer").withArgs(walletFrom.address, walletTo.address, amountToTransfer);

        const senderBalanceAfterTransfer: BigNumber = await l2EthToken.balanceOf(walletFrom.address);
        const recipientBalanceAfterTransfer: BigNumber = await l2EthToken.balanceOf(walletTo.address);
        expect(senderBalanceAfterTransfer).to.be.eq(senderBalandeBeforeTransfer.sub(amountToTransfer));
        expect(recipientBalanceAfterTransfer).to.be.eq(recipientBalanceBeforeTransfer.add(amountToTransfer));
    });

    it("should not tranfser due to insufficient balance", async () => {
        await l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, ethers.utils.parseEther("5.0"));

        const amountToTransfer = ethers.utils.parseEther("10.0");

        await expect(l2EthToken.connect(bootloaderAccount).transferFromTo(walletFrom.address, walletTo.address, amountToTransfer)).to.be.rejectedWith(
            "Transfer amount exceeds balance"
        );
    });

    it("should require special access for transfer", async () => {
        const provider = new Provider((hre.network.config as any).url);
        const maliciousData = {
            address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            privateKey: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        };
        const maliciousWallet: Wallet = new Wallet(maliciousData.privateKey, provider);
        await l2EthToken.connect(bootloaderAccount).mint(maliciousWallet.address, ethers.utils.parseEther("20.0"));

        const amountToTransfer = ethers.utils.parseEther("20.0");

        await expect(l2EthToken.connect(maliciousWallet).transferFromTo(maliciousWallet.address, walletTo.address, amountToTransfer)).to.be.rejectedWith(
            "Only system contracts with special access can call this method"
        );
    });

    it("should burn msg.value and emit Withdrawal event", async () => {

        const l1Receiver: Wallet = getWallets()[2];

        const amountToMint = ethers.utils.parseEther("100.0");
        const initialSupply = await l2EthToken.totalSupply();

        const gasPrice = await ethers.provider.getGasPrice();

        await l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, amountToMint);

        const tx = await l2EthToken.connect(walletFrom).withdraw(l1Receiver.address, { value: ethers.utils.parseEther("10.0"), gasLimit: 5000000, gasPrice });
        console.log(tx);
        const result = await tx.wait();
        console.log(result);



        // await expect(l2EthToken.withdraw(l1Receiver.address, { value: ethers.utils.parseEther("10.0"), gasLimit: 5000000, gasPrice }).then((tx) => tx.wait()))
        //     .to.emit(l2EthToken, "Withdrawal")
        //     .withArgs(walletFrom.address, l1Receiver.address, ethers.utils.parseEther("10.0"));

        expect(await l2EthToken.totalSupply()).to.equal(initialSupply.add(amountToMint).sub(ethers.utils.parseEther("10.0")));



        // const amountToMint = ethers.utils.parseEther("100.0");

        // const initialSupply: BigNumber = await l2EthToken.totalSupply();

        // await l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, amountToMint);
        // await expect(l2EthToken.withdraw(l1Receiver.address, { value: ethers.utils.parseEther("10.0"), gasLimit: 5000000 })).to.emit(l2EthToken, "Withdrawal");

        // const finalSupply: BigNumber = await l2EthToken.totalSupply();

        // await expect(finalSupply).to.equal(initialSupply.sub(ethers.utils.parseEther("10.0")));

        // const balanceAfterWithdrawal = await l2EthToken.balanceOf(walletFrom.address);

        // expect(balanceAfterWithdrawal).to.equal(amountToMint.sub(ethers.utils.parseEther("10.0")));
    });


})