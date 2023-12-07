import { expect } from "chai";
import { ethers, network } from "hardhat";
import type { ComplexUpgrader, MockContract } from "../typechain-types";
import { ComplexUpgrader__factory } from "../typechain-types";
import { COMPLEX_UPGRADER_CONTRACT_ADDRESS, FORCE_DEPLOYER_ADDRESS } from "./shared/constants";
import { deployContract, deployContractOnAddress, getWallets } from "./shared/utils";

describe("ComplexUpgrader tests", function () {
  let complexUpgrader: ComplexUpgrader;
  let dummyUpgrade: MockContract;

  before(async () => {
    const wallet = (await getWallets())[0];
    await deployContractOnAddress(COMPLEX_UPGRADER_CONTRACT_ADDRESS, "ComplexUpgrader");
    complexUpgrader = ComplexUpgrader__factory.connect(COMPLEX_UPGRADER_CONTRACT_ADDRESS, wallet);
    dummyUpgrade = (await deployContract("MockContract")) as MockContract;
  });

  describe("upgrade", function () {
    it("non force deployer failed to call", async () => {
      await expect(complexUpgrader.upgrade(dummyUpgrade.address, "0xdeadbeef")).to.be.revertedWith(
        "Can only be called by FORCE_DEPLOYER"
      );
    });

    it("successfully upgraded", async () => {
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [FORCE_DEPLOYER_ADDRESS],
      });

      const force_deployer = await ethers.getSigner(FORCE_DEPLOYER_ADDRESS);

      await expect(complexUpgrader.connect(force_deployer).upgrade(dummyUpgrade.address, "0xdeadbeef"))
        .to.emit(dummyUpgrade.attach(COMPLEX_UPGRADER_CONTRACT_ADDRESS), "Called")
        .withArgs(0, "0xdeadbeef");

      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [FORCE_DEPLOYER_ADDRESS],
      });
    });
  });
});
