import { expect } from "chai";
import { ethers } from "hardhat";
import { Provider, Wallet } from "zksync-web3";
import type { L2EthToken } from "../typechain-types";
import { deployContract, getWallets } from "./shared/utils";
import * as hre from "hardhat";
import type { BigNumber } from "ethers";
import { TEST_BOOTLOADER_FORMAL_ADDRESS } from "./shared/constants";
import { prepareEnvironment, setResult } from "./shared/mocks";

describe("L2EthToken tests", () => {
  let walletFrom: Wallet;
  let walletTo: Wallet;
  let l2EthToken: L2EthToken;
  let bootloaderAccount: ethers.Signer;
  let l1Receiver: Wallet;

  before(async () => {
    await prepareEnvironment();
    walletFrom = getWallets()[0];
    walletTo = getWallets()[1];
    l1Receiver = getWallets()[2];
    l2EthToken = (await deployContract("L2EthToken")) as L2EthToken;
    bootloaderAccount = await ethers.getImpersonatedSigner(TEST_BOOTLOADER_FORMAL_ADDRESS);
  });

  it("withdraw should only emit Withdrawal", async () => {
    await expect(l2EthToken.connect(walletFrom).withdrawShouldOnlyEmitWithdrawal()).to.emit(l2EthToken, "Withdrawal");
  });

  it("withdraw", async () => {
    const message: string = ethers.utils.defaultAbiCoder.encode(["address"], [l1Receiver.address]);
    await setResult("L1Messenger", "sendToL1", [message], {
      failure: false,
      returnData: ethers.utils.defaultAbiCoder.encode(["bytes32"], [ethers.utils.keccak256(message)]),
    });

    const amountToWithdraw: BigNumber = ethers.utils.parseEther("1.0");
    const gasPrice: BigNumber = await ethers.provider.getGasPrice();
    await expect(
      l2EthToken
        .connect(walletFrom)
        .withdraw(l1Receiver.address, { value: amountToWithdraw, gasLimit: 5000000, gasPrice })
    ).to.emit(l2EthToken, "Withdrawal");
  });

  it("withdrawWithMessage", async () => {
    const additionalData: string = ethers.utils.defaultAbiCoder.encode(["string"], ["additional data"]);
    const message: string = ethers.utils.defaultAbiCoder.encode(
      ["address", "bytes"],
      [l1Receiver.address, additionalData]
    );
    await setResult("L1Messenger", "sendToL1", [message], {
      failure: false,
      returnData: ethers.utils.defaultAbiCoder.encode(["bytes32"], [ethers.utils.keccak256(message)]),
    });

    const amountToWithdraw: BigNumber = ethers.utils.parseEther("1.0");
    const gasPrice: BigNumber = await ethers.provider.getGasPrice();
    await expect(
      l2EthToken.connect(walletFrom).withdrawWithMessage(l1Receiver.address, additionalData, {
        value: amountToWithdraw,
        gasLimit: 5000000,
        gasPrice,
      })
    ).to.emit(l2EthToken, "WithdrawalWithMessage");
  });

  it("mint", async () => {
    const initialSupply: BigNumber = await l2EthToken.totalSupply();
    const initialBalanceOfWallet: BigNumber = await l2EthToken.balanceOf(walletFrom.address);
    const amountToMint: BigNumber = ethers.utils.parseEther("10.0");

    await expect(l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, amountToMint))
      .to.emit(l2EthToken, "Mint")
      .withArgs(walletFrom.address, amountToMint);

    const finalSupply: BigNumber = await l2EthToken.totalSupply();
    const balanceOfWallet: BigNumber = await l2EthToken.balanceOf(walletFrom.address);

    expect(finalSupply).to.equal(initialSupply.add(amountToMint));
    expect(balanceOfWallet).to.equal(initialBalanceOfWallet.add(amountToMint));
  });

  it("transfer successfully", async () => {
    await l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, ethers.utils.parseEther("100.0"));

    const senderBalandeBeforeTransfer: BigNumber = await l2EthToken.balanceOf(walletFrom.address);
    const recipientBalanceBeforeTransfer: BigNumber = await l2EthToken.balanceOf(walletTo.address);

    const amountToTransfer = ethers.utils.parseEther("10.0");

    await expect(
      l2EthToken.connect(bootloaderAccount).transferFromTo(walletFrom.address, walletTo.address, amountToTransfer)
    )
      .to.emit(l2EthToken, "Transfer")
      .withArgs(walletFrom.address, walletTo.address, amountToTransfer);

    const senderBalanceAfterTransfer: BigNumber = await l2EthToken.balanceOf(walletFrom.address);
    const recipientBalanceAfterTransfer: BigNumber = await l2EthToken.balanceOf(walletTo.address);
    expect(senderBalanceAfterTransfer).to.be.eq(senderBalandeBeforeTransfer.sub(amountToTransfer));
    expect(recipientBalanceAfterTransfer).to.be.eq(recipientBalanceBeforeTransfer.add(amountToTransfer));
  });

  it("no tranfser due to insufficient balance", async () => {
    await l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, ethers.utils.parseEther("5.0"));
    const amountToTransfer: BigNumber = ethers.utils.parseEther("100000000000000000.0");

    await expect(
      l2EthToken.connect(bootloaderAccount).transferFromTo(walletFrom.address, walletTo.address, amountToTransfer)
    ).to.be.rejectedWith("Transfer amount exceeds balance");
  });

  it("no transfer - require special access", async () => {
    const provider: Provider = new Provider((hre.network.config as any).url);
    const maliciousData = {
      address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      privateKey: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    };
    const maliciousWallet: Wallet = new Wallet(maliciousData.privateKey, provider);
    await l2EthToken.connect(bootloaderAccount).mint(maliciousWallet.address, ethers.utils.parseEther("20.0"));

    const amountToTransfer: BigNumber = ethers.utils.parseEther("20.0");

    await expect(
      l2EthToken.connect(maliciousWallet).transferFromTo(maliciousWallet.address, walletTo.address, amountToTransfer)
    ).to.be.rejectedWith("Only system contracts with special access can call this method");
  });
});
