import { expect } from "chai";
import { ethers } from "hardhat";
import type { Wallet } from "zksync-web3";
import { IMailbox__factory, L2EthToken__factory } from "../typechain-types";
import type { L2EthToken } from "../typechain-types";
import { deployContractOnAddress, getWallets, provider } from "./shared/utils";
import type { BigNumber } from "ethers";
import { TEST_BOOTLOADER_FORMAL_ADDRESS, TEST_ETH_TOKEN_SYSTEM_CONTRACT_ADDRESS } from "./shared/constants";
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
    await deployContractOnAddress(TEST_ETH_TOKEN_SYSTEM_CONTRACT_ADDRESS, "L2EthToken");
    l2EthToken = L2EthToken__factory.connect(TEST_ETH_TOKEN_SYSTEM_CONTRACT_ADDRESS, walletFrom);
    bootloaderAccount = await ethers.getImpersonatedSigner(TEST_BOOTLOADER_FORMAL_ADDRESS);
  });

  describe("mint", () => {
    it("successful", async () => {
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

    it("not called by bootloader", async () => {
      const amountToMint: BigNumber = ethers.utils.parseEther("10.0");
      await expect(l2EthToken.connect(walletTo.address).mint(walletFrom.address, amountToMint)).to.be.rejectedWith(
        "Callable only by the bootloader"
      );
    });
  });

  describe("transfer", () => {
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
      const maliciousWallet: Wallet = ethers.Wallet.createRandom().connect(provider);
      await l2EthToken.connect(bootloaderAccount).mint(maliciousWallet.address, ethers.utils.parseEther("20.0"));

      const amountToTransfer: BigNumber = ethers.utils.parseEther("20.0");

      await expect(
        l2EthToken.connect(maliciousWallet).transferFromTo(maliciousWallet.address, walletTo.address, amountToTransfer)
      ).to.be.rejectedWith("Only system contracts with special access can call this method");
    });
  });

  describe("balanceOf", () => {
    it("walletFrom address", async () => {
      const amountToMint: BigNumber = ethers.utils.parseEther("10.0");

      await l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, amountToMint);
      const balance = await l2EthToken.balanceOf(walletFrom.address);
      expect(balance).to.equal(ethers.utils.parseEther("115.0"));
    });

    it("address larger than 20 bytes", async () => {
      const randomNum = Math.floor(Math.random() * 96) + 1;
      const randomExtra = ethers.BigNumber.from(2).pow(randomNum);
      const largerAddress = ethers.BigNumber.from(walletFrom.address).add(randomExtra).toHexString();

      const amountToMint: BigNumber = ethers.utils.parseEther("10.0");
      await l2EthToken.connect(bootloaderAccount).mint(largerAddress, amountToMint);
      const balance = await l2EthToken.balanceOf(largerAddress);
      expect(balance).to.equal(ethers.utils.parseEther("10.0"));
    });
  });

  describe("totalSupply", () => {
    it("correct total supply", async () => {
      const amountToMint: BigNumber = ethers.utils.parseEther("10.0");
      await l2EthToken.connect(bootloaderAccount).mint(walletFrom.address, amountToMint);
      const totalSupply = await l2EthToken.totalSupply();
      expect(totalSupply).to.equal(ethers.utils.parseEther("165.0"));
    });
  });

  describe("name", () => {
    it("correct name", async () => {
      const name = await l2EthToken.name();
      expect(name).to.equal("Ether");
    });
  });

  describe("symbol", () => {
    it("correct symbol", async () => {
      const symbol = await l2EthToken.symbol();
      expect(symbol).to.equal("ETH");
    });
  });

  describe("decimals", () => {
    it("correct decimals", async () => {
      const decimals = await l2EthToken.decimals();
      expect(decimals).to.equal(18);
    });
  });

  describe("withdraw", () => {
    it("successful, correct contract balance and total supply", async () => {
      const iface = IMailbox__factory.createInterface();
      const selector = iface.getSighash("finalizeEthWithdrawal");
      const amountToWithdraw: BigNumber = ethers.utils.parseEther("1.0");

      const message: string = ethers.utils.solidityPack(
        ["bytes4", "address", "uint256"],
        [selector, l1Receiver.address, amountToWithdraw]
      );

      await setResult("L1Messenger", "sendToL1", [message], {
        failure: false,
        returnData: ethers.utils.defaultAbiCoder.encode(["bytes32"], [ethers.utils.keccak256(message)]),
      });

      const amountToMint: BigNumber = ethers.utils.parseEther("100.0");
      await l2EthToken.connect(bootloaderAccount).mint(l2EthToken.address, amountToMint);

      const balanceBeforeWithdrawal: BigNumber = await l2EthToken.balanceOf(l2EthToken.address);
      const totalSupplyBefore = await l2EthToken.totalSupply();

      await expect(l2EthToken.connect(walletFrom).withdraw(l1Receiver.address, { value: amountToWithdraw }))
        .to.emit(l2EthToken, "Withdrawal")
        .withArgs(walletFrom.address, l1Receiver.address, amountToWithdraw);

      const balanceAfterWithdrawal: BigNumber = await l2EthToken.balanceOf(l2EthToken.address);
      const totalSupplyAfter = await l2EthToken.totalSupply();

      expect(balanceAfterWithdrawal).to.equal(balanceBeforeWithdrawal.sub(amountToWithdraw));
      expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(amountToWithdraw));
    });

    it("big amount to withdraw, underflow contract balance", async () => {
      const iface = IMailbox__factory.createInterface();
      const selector = iface.getSighash("finalizeEthWithdrawal");
      const amountToWithdraw: BigNumber = ethers.utils.parseEther("300.0");

      const message: string = ethers.utils.solidityPack(
        ["bytes4", "address", "uint256"],
        [selector, l1Receiver.address, amountToWithdraw]
      );

      await setResult("L1Messenger", "sendToL1", [message], {
        failure: false,
        returnData: ethers.utils.defaultAbiCoder.encode(["bytes32"], [ethers.utils.keccak256(message)]),
      });

      const amountToMint: BigNumber = ethers.utils.parseEther("100.0");
      await l2EthToken.connect(bootloaderAccount).mint(l2EthToken.address, amountToMint);

      const balanceBeforeWithdrawal: BigNumber = await l2EthToken.balanceOf(l2EthToken.address);

      await expect(l2EthToken.connect(walletFrom).withdraw(l1Receiver.address, { value: amountToWithdraw }))
        .to.emit(l2EthToken, "Withdrawal")
        .withArgs(walletFrom.address, l1Receiver.address, amountToWithdraw);

      const balanceAfterWithdrawal: BigNumber = await l2EthToken.balanceOf(l2EthToken.address);
      const expectedBalanceAfterWithdrawal = ethers.BigNumber.from(2)
        .pow(256)
        .add(balanceBeforeWithdrawal)
        .sub(amountToWithdraw);
      expect(balanceAfterWithdrawal).to.equal(expectedBalanceAfterWithdrawal);
    });
  });

  describe("withdrawWithMessage", () => {
    it("successful", async () => {
      const iface = IMailbox__factory.createInterface();
      const selector = iface.getSighash("finalizeEthWithdrawal");
      const amountToWidthdraw: BigNumber = ethers.utils.parseEther("1.0");
      const additionalData: string = ethers.utils.defaultAbiCoder.encode(["string"], ["additional data"]);
      const message: string = ethers.utils.solidityPack(
        ["bytes4", "address", "uint256", "address", "bytes"],
        [selector, l1Receiver.address, amountToWidthdraw, walletFrom.address, additionalData]
      );

      await setResult("L1Messenger", "sendToL1", [message], {
        failure: false,
        returnData: ethers.utils.defaultAbiCoder.encode(["bytes32"], [ethers.utils.keccak256(message)]),
      });

      const amountToWithdraw: BigNumber = ethers.utils.parseEther("1.0");
      const totalSupplyBefore = await l2EthToken.totalSupply();
      const balanceBeforeWithdrawal: BigNumber = await l2EthToken.balanceOf(l2EthToken.address);
      await expect(
        l2EthToken.connect(walletFrom).withdrawWithMessage(l1Receiver.address, additionalData, {
          value: amountToWithdraw,
        })
      )
        .to.emit(l2EthToken, "WithdrawalWithMessage")
        .withArgs(walletFrom.address, l1Receiver.address, amountToWithdraw, additionalData);
      const totalSupplyAfter = await l2EthToken.totalSupply();
      const balanceAfterWithdrawal: BigNumber = await l2EthToken.balanceOf(l2EthToken.address);
      expect(balanceAfterWithdrawal).to.equal(balanceBeforeWithdrawal.sub(amountToWithdraw));
      expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(amountToWithdraw));
    });
  });
});