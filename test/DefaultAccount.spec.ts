import { expect } from "chai";
import { ethers, network } from "hardhat";
import * as zksync from "zksync-web3";
import type { Wallet } from "zksync-web3";
import { serialize } from "zksync-web3/build/src/utils";
import type { DefaultAccount, L2EthToken, MockContract } from "../typechain-types";
import { DefaultAccount__factory, L2EthToken__factory, MockContract__factory } from "../typechain-types";
import {
  BOOTLOADER_FORMAL_ADDRESS,
  ETH_TOKEN_SYSTEM_CONTRACT_ADDRESS,
  MSG_VALUE_SYSTEM_CONTRACT_ADDRESS,
  NONCE_HOLDER_SYSTEM_CONTRACT_ADDRESS,
} from "./shared/constants";
import { signedTxToTransactionData } from "./shared/transactions";
import { deployContract, deployContractOnAddress, getWallets, loadArtifact, setCode } from "./shared/utils";

// TODO: more test cases can be added, `DelegateCaller` can be useful.
describe("DefaultAccount tests", function () {
  let wallet: Wallet;
  let bootloaderAccount: ethers.Signer;

  let defaultAccount: DefaultAccount;
  let account: Wallet;
  let mockNonceHolder: MockContract; // eslint-disable-line
  let mockMsgValueSimulator: MockContract;
  let mockBootloaderFormalAddress: MockContract;
  let l2EthToken: L2EthToken; // eslint-disable-line
  let callable: MockContract;
  let mockERC20: MockContract;

  let paymasterFlowIface: ethers.utils.Interface;
  let nonceHolderIface: ethers.utils.Interface; // eslint-disable-line
  let ERC20Iface: ethers.utils.Interface;

  const RANDOM_ADDRESS = ethers.utils.getAddress("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");

  before(async () => {
    wallet = getWallets()[0];
    account = getWallets()[2];

    const defaultAccountArtifact = await loadArtifact("DefaultAccount");
    await setCode(account.address, defaultAccountArtifact.bytecode);
    defaultAccount = DefaultAccount__factory.connect(account.address, wallet);

    await deployContractOnAddress(NONCE_HOLDER_SYSTEM_CONTRACT_ADDRESS, "MockContract");
    mockNonceHolder = MockContract__factory.connect(NONCE_HOLDER_SYSTEM_CONTRACT_ADDRESS, wallet);

    await deployContractOnAddress(MSG_VALUE_SYSTEM_CONTRACT_ADDRESS, "MockContract");
    mockMsgValueSimulator = MockContract__factory.connect(MSG_VALUE_SYSTEM_CONTRACT_ADDRESS, wallet);

    await deployContractOnAddress(BOOTLOADER_FORMAL_ADDRESS, "MockContract");
    mockBootloaderFormalAddress = MockContract__factory.connect(BOOTLOADER_FORMAL_ADDRESS, wallet);

    l2EthToken = L2EthToken__factory.connect(ETH_TOKEN_SYSTEM_CONTRACT_ADDRESS, wallet);
    callable = (await deployContract("MockContract")) as MockContract;
    mockERC20 = (await deployContract("MockContract")) as MockContract;

    paymasterFlowIface = new ethers.utils.Interface((await loadArtifact("IPaymasterFlow")).abi);
    nonceHolderIface = new ethers.utils.Interface((await loadArtifact("NonceHolder")).abi);
    ERC20Iface = new ethers.utils.Interface((await loadArtifact("IERC20")).abi);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BOOTLOADER_FORMAL_ADDRESS],
    });
    bootloaderAccount = await ethers.getSigner(BOOTLOADER_FORMAL_ADDRESS);
  });

  after(async function () {
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [BOOTLOADER_FORMAL_ADDRESS],
    });
  });

  describe("validateTransaction", function () {
    it("non-deployer ignored", async () => {
      const legacyTx = await account.populateTransaction({
        type: 0,
        to: RANDOM_ADDRESS,
        from: account.address,
        nonce: 1,
        data: "0x",
        value: 0,
        gasLimit: 50000,
      });
      const txBytes = await account.signTransaction(legacyTx);
      const parsedTx = zksync.utils.parseTransaction(txBytes);
      const txData = signedTxToTransactionData(parsedTx)!;

      const txHash = parsedTx.hash;
      delete legacyTx.from;
      const signedHash = ethers.utils.keccak256(serialize(legacyTx));

      const call = {
        from: wallet.address,
        to: defaultAccount.address,
        value: 0,
        data: defaultAccount.interface.encodeFunctionData("validateTransaction", [txHash, signedHash, txData]),
      };
      expect(await wallet.provider.call(call)).to.be.eq("0x");
    });

    it("invalid signature", async () => {
      const legacyTx = await account.populateTransaction({
        type: 0,
        to: RANDOM_ADDRESS,
        from: account.address,
        nonce: 1,
        data: "0x",
        value: 0,
        gasLimit: 50000,
      });
      const txBytes = await account.signTransaction(legacyTx);
      const parsedTx = zksync.utils.parseTransaction(txBytes);
      parsedTx.s = "0x0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0";
      const txData = signedTxToTransactionData(parsedTx)!;

      const txHash = parsedTx.hash;
      delete legacyTx.from;
      const signedHash = ethers.utils.keccak256(serialize(legacyTx));

      const call = {
        from: BOOTLOADER_FORMAL_ADDRESS,
        to: defaultAccount.address,
        value: 0,
        data: defaultAccount.interface.encodeFunctionData("validateTransaction", [txHash, signedHash, txData]),
      };
      expect(await bootloaderAccount.provider.call(call)).to.be.eq(ethers.constants.HashZero);
    });

    it("valid tx", async () => {
      const legacyTx = await account.populateTransaction({
        type: 0,
        to: RANDOM_ADDRESS,
        from: account.address,
        nonce: 5,
        data: "0x",
        value: 0,
        gasLimit: 50000,
      });
      const txBytes = await account.signTransaction(legacyTx);
      const parsedTx = zksync.utils.parseTransaction(txBytes);
      const txData = signedTxToTransactionData(parsedTx)!;

      const txHash = parsedTx.hash;
      delete legacyTx.from;
      const signedHash = ethers.utils.keccak256(serialize(legacyTx));

      const call = {
        from: BOOTLOADER_FORMAL_ADDRESS,
        to: defaultAccount.address,
        value: 0,
        data: defaultAccount.interface.encodeFunctionData("validateTransaction", [txHash, signedHash, txData]),
      };
      expect(await bootloaderAccount.provider.call(call)).to.be.eq(
        defaultAccount.interface.getSighash("validateTransaction") + "0".repeat(56)
      );
    });
  });

  describe("executeTransaction", function () {
    it("non-deployer ignored", async () => {
      const legacyTx = await account.populateTransaction({
        type: 0,
        to: callable.address,
        from: account.address,
        nonce: 111,
        data: "0xdeadbeef",
        value: 5,
        gasLimit: 50000,
      });
      const txBytes = await account.signTransaction(legacyTx);
      const parsedTx = zksync.utils.parseTransaction(txBytes);
      const txData = signedTxToTransactionData(parsedTx)!;

      const txHash = parsedTx.hash;
      delete legacyTx.from;
      const signedHash = ethers.utils.keccak256(serialize(legacyTx));

      await expect(await defaultAccount.executeTransaction(txHash, signedHash, txData)).to.not.emit(callable, "Called");
    });

    it("successfully executed", async () => {
      const legacyTx = await account.populateTransaction({
        type: 0,
        to: callable.address,
        from: account.address,
        nonce: 111,
        data: "0xdeadbeef",
        value: 0,
        gasLimit: 50000,
      });
      const txBytes = await account.signTransaction(legacyTx);
      const parsedTx = zksync.utils.parseTransaction(txBytes);
      const txData = signedTxToTransactionData(parsedTx)!;

      const txHash = parsedTx.hash;
      delete legacyTx.from;
      const signedHash = ethers.utils.keccak256(serialize(legacyTx));

      await expect(await defaultAccount.connect(bootloaderAccount).executeTransaction(txHash, signedHash, txData))
        .to.emit(callable, "Called")
        .withArgs(0, "0xdeadbeef");
    });

    it("non-zero value", async () => {
      const legacyTx = await account.populateTransaction({
        type: 0,
        to: callable.address,
        from: account.address,
        nonce: 111,
        data: "0x",
        value: 5,
        gasLimit: 50000,
      });
      const txBytes = await account.signTransaction(legacyTx);
      const parsedTx = zksync.utils.parseTransaction(txBytes);
      const txData = signedTxToTransactionData(parsedTx)!;

      const txHash = parsedTx.hash;
      delete legacyTx.from;
      const signedHash = ethers.utils.keccak256(serialize(legacyTx));

      await expect(await defaultAccount.connect(bootloaderAccount).executeTransaction(txHash, signedHash, txData))
        .to.emit(mockMsgValueSimulator, "Called")
        .withArgs(0, "0x");
    });
  });

  describe("executeTransactionFromOutside", function () {
    it("nothing", async () => {
      const legacyTx = await account.populateTransaction({
        type: 0,
        to: callable.address,
        from: account.address,
        nonce: 111,
        data: "0xdeadbeef",
        value: 5,
        gasLimit: 50000,
      });
      const txBytes = await account.signTransaction(legacyTx);
      const parsedTx = zksync.utils.parseTransaction(txBytes);
      const txData = signedTxToTransactionData(parsedTx)!;

      delete legacyTx.from;

      await expect(await defaultAccount.executeTransactionFromOutside(txData)).to.not.emit(callable, "Called");
    });
  });

  describe("payForTransaction", function () {
    before(async () => {});
    it("non-deployer ignored", async () => {
      const legacyTx = await account.populateTransaction({
        type: 0,
        to: callable.address,
        from: account.address,
        nonce: 1,
        data: "0xdeadbeef",
        value: 5,
        gasLimit: 50000,
        gasPrice: 200,
      });
      const txBytes = await account.signTransaction(legacyTx);
      const parsedTx = zksync.utils.parseTransaction(txBytes);
      const txData = signedTxToTransactionData(parsedTx)!;

      const txHash = parsedTx.hash;
      delete legacyTx.from;
      const signedHash = ethers.utils.keccak256(serialize(legacyTx));

      await expect(defaultAccount.payForTransaction(txHash, signedHash, txData)).to.not.emit(
        mockBootloaderFormalAddress,
        "Called"
      );
    });

    it("successfully payed", async () => {
      const legacyTx = await account.populateTransaction({
        type: 0,
        to: callable.address,
        from: account.address,
        nonce: 2,
        data: "0xdeadbeef",
        value: 5,
        gasLimit: 50000,
        gasPrice: 200,
      });
      const txBytes = await account.signTransaction(legacyTx);
      const parsedTx = zksync.utils.parseTransaction(txBytes);
      const txData = signedTxToTransactionData(parsedTx)!;

      const txHash = parsedTx.hash;
      delete legacyTx.from;
      const signedHash = ethers.utils.keccak256(serialize(legacyTx));

      await expect(await defaultAccount.connect(bootloaderAccount).payForTransaction(txHash, signedHash, txData))
        .to.emit(mockBootloaderFormalAddress, "Called")
        .withArgs(50000 * 200, "0x");
    });
  });

  describe("prepareForPaymaster", function () {
    it("non-deployer ignored", async () => {
      const eip712Tx = await account.populateTransaction({
        type: 113,
        to: callable.address,
        from: account.address,
        data: "0x",
        value: 0,
        maxFeePerGas: 12000,
        maxPriorityFeePerGas: 100,
        gasLimit: 50000,
        customData: {
          gasPerPubdata: zksync.utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
          paymasterParams: {
            paymaster: RANDOM_ADDRESS,
            paymasterInput: paymasterFlowIface.encodeFunctionData("approvalBased", [mockERC20.address, 2023, "0x"]),
          },
        },
      });
      const signedEip712Tx = await account.signTransaction(eip712Tx);
      const parsedEIP712tx = zksync.utils.parseTransaction(signedEip712Tx);

      const eip712TxData = signedTxToTransactionData(parsedEIP712tx)!;
      const eip712TxHash = parsedEIP712tx.hash;
      const eip712SignedHash = zksync.EIP712Signer.getSignedDigest(eip712Tx);

      await expect(await defaultAccount.prepareForPaymaster(eip712TxHash, eip712SignedHash, eip712TxData)).to.not.emit(
        mockERC20,
        "Called"
      );
    });

    it("successfully prepared", async () => {
      await mockERC20.setResult(ERC20Iface.encodeFunctionData("allowance", [account.address, RANDOM_ADDRESS]), {
        failure: false,
        returnData: ethers.constants.HashZero,
      });
      const eip712Tx = await account.populateTransaction({
        type: 113,
        to: callable.address,
        from: account.address,
        data: "0x",
        value: 0,
        maxFeePerGas: 12000,
        maxPriorityFeePerGas: 100,
        gasLimit: 50000,
        customData: {
          gasPerPubdata: zksync.utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
          paymasterParams: {
            paymaster: RANDOM_ADDRESS,
            paymasterInput: paymasterFlowIface.encodeFunctionData("approvalBased", [mockERC20.address, 2023, "0x"]),
          },
        },
      });
      const signedEip712Tx = await account.signTransaction(eip712Tx);
      const parsedEIP712tx = zksync.utils.parseTransaction(signedEip712Tx);

      const eip712TxData = signedTxToTransactionData(parsedEIP712tx)!;
      const eip712TxHash = parsedEIP712tx.hash;
      const eip712SignedHash = zksync.EIP712Signer.getSignedDigest(eip712Tx);

      await expect(
        await defaultAccount
          .connect(bootloaderAccount)
          .prepareForPaymaster(eip712TxHash, eip712SignedHash, eip712TxData)
      )
        .to.emit(mockERC20, "Called")
        .withArgs(0, ERC20Iface.encodeFunctionData("approve", [RANDOM_ADDRESS, 2023]));
    });
  });

  describe("fallback/receive", function () {
    it("zero value", async () => {
      const call = {
        from: wallet.address,
        to: defaultAccount.address,
        value: 0,
        data: "0x872384894899834939049043904390390493434343434344433443433434344234234234",
      };
      expect(await wallet.provider.call(call)).to.be.eq("0x");
    });

    it("non-zero value", async () => {
      const call = {
        from: wallet.address,
        to: defaultAccount.address,
        value: 3223,
        data: "0x87238489489983493904904390431212224343434344433443433434344234234234",
      };
      expect(await wallet.provider.call(call)).to.be.eq("0x");
    });
  });
});
