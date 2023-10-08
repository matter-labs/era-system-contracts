import { ethers } from "ethers";
import fs from "fs";
import { hashBytecode } from "zksync-web3/build/src/utils";

type Hashes = {
  sourceCodeHash: string;
  byteCodeHash: string;
};

type SystemContractsHashes = {
  bootloader: Hashes;
  defaultAA: Hashes;
};

const BOOTLOADER_SOURCE_CODE_PATH = "./bootloader/build/proved_batch.yul";
const BOOTLOADER_BYTECODE_PATH =
  "./bootloader/build/artifacts/proved_batch.yul/proved_batch.yul.zbin";
const DEFAULT_ACCOUNT_SOURCE_CODE_PATH = "./contracts/DefaultAccount.sol";
const DEFAULT_ACCOUNT_JSON_PATH =
  "./artifacts-zk/cache-zk/solpp-generated-contracts/DefaultAccount.sol/DefaultAccount.json";
const OUTPUT_FILE_PATH = "./SystemContractsHashes.json";

const readFileAsHexString = (path: string, errorMessage: string): string => {
  try {
    return "0x" + fs.readFileSync(path, "hex");
  } catch {
    throw new Error(errorMessage);
  }
};

const loadBytecodeFromJson = (path: string, errorMessage: string): string => {
  try {
    const jsonFile = fs.readFileSync(path, "utf8");
    return JSON.parse(jsonFile).bytecode;
  } catch {
    throw new Error(errorMessage);
  }
};

const getHashes = (
  sourceCode: string,
  bytecode: string,
  errorMessage: string
): Hashes => {
  try {
    return {
      sourceCodeHash: ethers.utils.sha256(sourceCode),
      byteCodeHash: ethers.utils.hexlify(hashBytecode(bytecode)),
    };
  } catch {
    throw new Error(errorMessage);
  }
};

const main = async () => {
  const checkOnly = process.argv.includes("--check-only");

  const bootloaderSourceCode = readFileAsHexString(
    BOOTLOADER_SOURCE_CODE_PATH,
    "Failed to read Bootloader source code. Make sure to run `yarn build-yul` before you run this script!"
  );
  const bootloaderBytecode = readFileAsHexString(
    BOOTLOADER_BYTECODE_PATH,
    "Failed to read Bootloader bytecode. Make sure to run `yarn build-yul` before you run this script!"
  );
  const defaultAASourceCode = readFileAsHexString(
    DEFAULT_ACCOUNT_SOURCE_CODE_PATH,
    "Failed to read DefaultAccount source code. Make sure to run `yarn build` before you run this script!"
  );
  const defaultAABytecode = loadBytecodeFromJson(
    DEFAULT_ACCOUNT_JSON_PATH,
    "Failed to read DefaultAccount bytecode. Make sure to run `yarn build` before you run this script!"
  );

  const systemContractsHashes: SystemContractsHashes = {
    bootloader: getHashes(
      bootloaderSourceCode,
      bootloaderBytecode,
      "Failed to calculate Bootloader hashes."
    ),
    defaultAA: getHashes(
      defaultAASourceCode,
      defaultAABytecode,
      "Failed to calculate DefaultAccount hashes."
    ),
  };

  const newSystemContractsHashes = JSON.stringify(
    systemContractsHashes,
    null,
    2
  );

  const oldSystemContractsHashes = fs.readFileSync(OUTPUT_FILE_PATH, "utf8");

  if (oldSystemContractsHashes === newSystemContractsHashes) {
    console.log(
      "Calculated hashes match the hashes in the SystemContractsHashes.json file."
    );
    return;
  } else if (checkOnly) {
    console.error(
      "Calculated hashes differ from the hashes in the SystemContractsHashes.json file. Exiting..."
    );
    process.exit(1);
  } else {
    console.log(
      "Calculated hashes differ from the hashes in the SystemContractsHashes.json file. Updating..."
    );

    fs.writeFileSync(OUTPUT_FILE_PATH, newSystemContractsHashes);
    console.log("Update finished. New hashes:");
    console.log(newSystemContractsHashes);
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err.message || err);
    process.exit(1);
  });
