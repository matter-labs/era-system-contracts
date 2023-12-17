import { expect } from "chai";
import type { Contract } from "zksync-web3";
import { callFallback, deployContractYul } from "./shared/utils";

describe("P256VERIFY tests", function () {
  let P256VERIFY: Contract;

  before(async () => {
    P256VERIFY = await deployContractYul("P256VERIFY", "precompiles");
  });

  describe("Lambdas tests", function () {
    it("Valid signature one", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "93973e2948748003bc6c947d56a47411ea1c812b358be9d0189e2bd0a0b9d11eb03ae0c6a0e3e3ff4af4d16ee034277d34c6a8aa63c502d99b1d162961d07d59114fc42e88471db9de64d0ce23e37800a3b07af311d55119adcc82594b7492bb3caf1e7f618f833b6364862c701c6a1ce93fbeef210ef53f97619a8e0ad5c7b1b6a99bc96565cfdfa61439c441260232c6430726192fbb1cedc36f41570659f2"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"
      );
    });

    it("Valid signature two", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "5ad83880e16658d7521d4e878521defaf6b43dec1dbd69e514c09ab8f1f2ffe255affc6e5faba2ece4d686fd0ca1ed497325bcc2557b4186a54c62d244e692b5871c518be8c56e7f5c901933fdab317efafc588b3e04d19d9a27b29aad8d9e690dca12ea554ca09172dcba021d5965cdf3510180776207c73ade33b75e964bfeb48e217c2059c99a9a36a0297caaaff294b4dc080c5fc78f6af3bab3643c70c4"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
      );
    });

    it("Invalid signature one", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "4ad83880e16658d7521d4e878521defaf6b43dec1dbd69e514c09ab8f1f2ffe255affc6e5faba2ece4d686fd0ca1ed497325bcc2557b4186a54c62d244e692b5871c518be8c56e7f5c901933fdab317efafc588b3e04d19d9a27b29aad8d9e690dca12ea554ca09172dcba021d5965cdf3510180776207c73ade33b75e964bfeb48e217c2059c99a9a36a0297caaaff294b4dc080c5fc78f6af3bab3643c70c4"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Invalid signature two", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "5ad83880e16658d7521d4e878521defaf6b43dec1dbd69e514c09ab8f1f2ffe25ad83880e16658d7521d4e878521defaf6b43dec1dbd69e514c09ab8f1f2ffe2871c518be8c56e7f5c901933fdab317efafc588b3e04d19d9a27b29aad8d9e696b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296b01cbd1c01e58065711814b583f061e9d431cca994cea1313449bf97c840ae0a"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Invalid r", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "5ad83880e16658d7521d4e878521defaf6b43dec1dbd69e514c09ab8f1f2ffe2FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632552a88a96ec0a98f29280ddffa35d63fb815c1d1d9c674838f01c4e49371e382983131c7301e8ac9e75cc8008b27e136e452a4e5b6112eae1296be30a0fa7274d5b9f5dde779183b71d1e50ac1cbcdbc52b62807ceb829000ab2986761e92f852e3"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Invalid s", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "5ad83880e16658d7521d4e878521defaf6b43dec1dbd69e514c09ab8f1f2ffe255affc6e5faba2ece4d686fd0ca1ed497325bcc2557b4186a54c62d244e692b5FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC6325520dca12ea554ca09172dcba021d5965cdf3510180776207c73ade33b75e964bfeb48e217c2059c99a9a36a0297caaaff294b4dc080c5fc78f6af3bab3643c70c4"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Public key is infinity", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "93973e2948748003bc6c947d56a47411ea1c812b358be9d0189e2bd0a0b9d11eb03ae0c6a0e3e3ff4af4d16ee034277d34c6a8aa63c502d99b1d162961d07d59114fc42e88471db9de64d0ce23e37800a3b07af311d55119adcc82594b7492bb00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Public key x coordinate not in field", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "93973e2948748003bc6c947d56a47411ea1c812b358be9d0189e2bd0a0b9d11eb03ae0c6a0e3e3ff4af4d16ee034277d34c6a8aa63c502d99b1d162961d07d59114fc42e88471db9de64d0ce23e37800a3b07af311d55119adcc82594b7492bb00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Public key y coordinate not in field", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "93973e2948748003bc6c947d56a47411ea1c812b358be9d0189e2bd0a0b9d11eb03ae0c6a0e3e3ff4af4d16ee034277d34c6a8aa63c502d99b1d162961d07d59114fc42e88471db9de64d0ce23e37800a3b07af311d55119adcc82594b7492bb3caf1e7f618f833b6364862c701c6a1ce93fbeef210ef53f97619a8e0ad5c7b1ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Public key not in curve", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "5ad83880e16658d7521d4e878521defaf6b43dec1dbd69e514c09ab8f1f2ffe255affc6e5faba2ece4d686fd0ca1ed497325bcc2557b4186a54c62d244e692b5871c518be8c56e7f5c901933fdab317efafc588b3e04d19d9a27b29aad8d9e690dca12ea554ca09172dcba021d5965cdf3510180776207c73ade33b75e964bffb48e217c2059c99a9a36a0297caaaff294b4dc080c5fc78f6af3bab3643c70c5"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Hash edge case valid 1", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "00000000000000000000000000000000000000000000000000000000000000018c47ad0afe2e980cc144632bdc1d442c34fd234661f9cb983e66a59abc1eed05844c7bf016cf7cb4ae740fac63cc8ca08e6db74890d94db8954c52fd77bf040c6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
      );
    });

    it("Hash edge case valid 2", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "00000000000000000000000000000000000000000000000000000000000000016b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2966b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2976b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
      );
    });

    it("Hash edge case valid 3", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "00000000000000000000000000000000000000000000000000000000000000006b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2966b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2966b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
      );
    });

    it("Hash edge case valid 4", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2966b17d1f3e12c4246f8bce6e563a440f2ba1c82d386d3951c00e76e82dc359d446b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
      );
    });

    it("Hash edge case valid 5", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc6325516b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2966b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2966b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
      );
    });

    it("Hash edge case valid 6", async () => {
      const returnData = await callFallback(
        P256VERIFY,
        "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc6325506b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2966b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2956b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
      );
      await expect(returnData).to.be.equal(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
      );
    });
  });
});
