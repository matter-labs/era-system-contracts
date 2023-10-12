import { ethers } from "ethers";
import * as fs from "fs";
import _ from "lodash";
import { join } from "path";
import { hashBytecode } from "zksync-web3/build/src/utils";

type ContractDetails = {
  contractName: string;
  sourceCodePath: string;
  bytecodePath: string;
};

const SYSTEM_CONTRACTS_DETAILS: ContractDetails[] = [
  // contracts dir sol
  {
    contractName: "AccountCodeStorage",
    sourceCodePath: "contracts/AccountCodeStorage.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/AccountCodeStorage.sol/AccountCodeStorage.json",
  },
  {
    contractName: "BootloaderUtilities",
    sourceCodePath: "contracts/BootloaderUtilities.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/BootloaderUtilities.sol/BootloaderUtilities.json",
  },
  {
    contractName: "ComplexUpgrader",
    sourceCodePath: "contracts/ComplexUpgrader.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/ComplexUpgrader.sol/ComplexUpgrader.json",
  },
  {
    contractName: "Compressor",
    sourceCodePath: "contracts/Compressor.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/Compressor.sol/Compressor.json",
  },
  {
    contractName: "ContractDeployer",
    sourceCodePath: "contracts/ContractDeployer.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/ContractDeployer.sol/ContractDeployer.json",
  },
  {
    contractName: "DefaultAccount",
    sourceCodePath: "contracts/DefaultAccount.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/DefaultAccount.sol/DefaultAccount.json",
  },
  {
    contractName: "EmptyContract",
    sourceCodePath: "contracts/EmptyContract.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/EmptyContract.sol/EmptyContract.json",
  },
  {
    contractName: "ImmutableSimulator",
    sourceCodePath: "contracts/ImmutableSimulator.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/ImmutableSimulator.sol/ImmutableSimulator.json",
  },
  {
    contractName: "KnownCodesStorage",
    sourceCodePath: "contracts/KnownCodesStorage.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/KnownCodesStorage.sol/KnownCodesStorage.json",
  },
  {
    contractName: "L1Messenger",
    sourceCodePath: "contracts/L1Messenger.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/L1Messenger.sol/L1Messenger.json",
  },
  {
    contractName: "L2EthToken",
    sourceCodePath: "contracts/L2EthToken.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/L2EthToken.sol/L2EthToken.json",
  },
  {
    contractName: "MsgValueSimulator",
    sourceCodePath: "contracts/MsgValueSimulator.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/MsgValueSimulator.sol/MsgValueSimulator.json",
  },
  {
    contractName: "NonceHolder",
    sourceCodePath: "contracts/NonceHolder.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/NonceHolder.sol/NonceHolder.json",
  },
  {
    contractName: "SystemContext",
    sourceCodePath: "contracts/SystemContext.sol",
    bytecodePath:
      "artifacts-zk/cache-zk/solpp-generated-contracts/SystemContext.sol/SystemContext.json",
  },
  // contracts dir yul
  {
    contractName: "EventWriter",
    sourceCodePath: "contracts/EventWriter.yul",
    bytecodePath: "contracts/artifacts/EventWriter.yul/EventWriter.yul.zbin",
  },
  // precompiles dir yul
  {
    contractName: "EcAdd",
    sourceCodePath: "contracts/precompiles/EcAdd.yul",
    bytecodePath: "contracts/precompiles/artifacts/EcAdd.yul/EcAdd.yul.zbin",
  },
  {
    contractName: "EcMul",
    sourceCodePath: "contracts/precompiles/EcMul.yul",
    bytecodePath: "contracts/precompiles/artifacts/EcMul.yul/EcMul.yul.zbin",
  },
  {
    contractName: "Ecrecover",
    sourceCodePath: "contracts/precompiles/Ecrecover.yul",
    bytecodePath:
      "contracts/precompiles/artifacts/Ecrecover.yul/Ecrecover.yul.zbin",
  },
  {
    contractName: "Keccak256",
    sourceCodePath: "contracts/precompiles/Keccak256.yul",
    bytecodePath:
      "contracts/precompiles/artifacts/Keccak256.yul/Keccak256.yul.zbin",
  },
  {
    contractName: "SHA256",
    sourceCodePath: "contracts/precompiles/SHA256.yul",
    bytecodePath: "contracts/precompiles/artifacts/SHA256.yul/SHA256.yul.zbin",
  },
  // bootloader dir yul
  {
    contractName: "proved_batch",
    sourceCodePath: "bootloader/build/proved_batch.yul",
    bytecodePath:
      "bootloader/build/artifacts/proved_batch.yul/proved_batch.yul.zbin",
  },
];

type Hashes = {
  sourceCodeHash: string;
  bytecodeHash: string;
};

type SystemContractHashes = ContractDetails & Hashes;

const makePathAbsolute = (path: string): string => {
  return join(__dirname, "..", path);
};

const readSourceCode = (details: ContractDetails): string => {
  const absolutePath = makePathAbsolute(details.sourceCodePath);
  try {
    return ethers.utils.hexlify(fs.readFileSync(absolutePath));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(
      `Failed to read source code for ${details.contractName}: ${absolutePath} Error: ${msg}`
    );
  }
};

const readBytecode = (details: ContractDetails): string => {
  const absolutePath = makePathAbsolute(details.bytecodePath);
  try {
    if (details.bytecodePath.endsWith(".json")) {
      const jsonFile = fs.readFileSync(absolutePath, "utf8");
      return ethers.utils.hexlify(JSON.parse(jsonFile).bytecode);
    } else {
      return ethers.utils.hexlify(fs.readFileSync(absolutePath));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(
      `Failed to read bytecode for ${details.contractName}: ${details.bytecodePath} Error: ${msg}`
    );
  }
};

const getHashes = (
  contractName: string,
  sourceCode: string,
  bytecode: string
): Hashes => {
  try {
    return {
      bytecodeHash: ethers.utils.hexlify(hashBytecode(bytecode)),
      // The extra checks performed by the hashBytecode function are not needed for the source code, therefore
      // sha256 is used for simplicity
      sourceCodeHash: ethers.utils.sha256(sourceCode),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(
      `Failed to calculate hashes for ${contractName} Error: ${msg}`
    );
  }
};

const getSystemContractsHashes = (
  systemContractsDetails: ContractDetails[]
): SystemContractHashes[] =>
  systemContractsDetails.map((contractDetails) => {
    const sourceCode = readSourceCode(contractDetails);
    const bytecode = readBytecode(contractDetails);
    const hashes = getHashes(
      contractDetails.contractName,
      sourceCode,
      bytecode
    );

    const systemContractHashes: SystemContractHashes = {
      ...contractDetails,
      ...hashes,
    };

    return systemContractHashes;
  });

const OUTPUT_FILE_PATH = "SystemContractsHashes.json";

const readSystemContractsHashesFile = (
  path: string
): SystemContractHashes[] => {
  const absolutePath = makePathAbsolute(path);
  try {
    const file = fs.readFileSync(absolutePath, "utf8");
    const parsedFile = JSON.parse(file);
    return parsedFile;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Failed to read file: ${absolutePath} Error: ${msg}`);
  }
};

const saveSystemContractsHashesFile = (
  path: string,
  systemContractsHashes: SystemContractHashes[]
) => {
  const absolutePath = makePathAbsolute(path);
  try {
    fs.writeFileSync(
      absolutePath,
      JSON.stringify(systemContractsHashes, null, 2)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Failed to save file: ${absolutePath} Error: ${msg}`);
  }
};

const findDifferences = (
  newHashes: SystemContractHashes[],
  oldHashes: SystemContractHashes[]
) => {
  const differentElements = _.xorWith(newHashes, oldHashes, _.isEqual);

  const differentUniqueElements = _.uniqWith(
    differentElements,
    (a, b) => a.contractName === b.contractName
  );

  const differencesList = differentUniqueElements.map((diffElem) => {
    const newHashesElem = newHashes.find(
      (elem) => elem.contractName === diffElem.contractName
    );

    const oldHashesElem = oldHashes.find(
      (elem) => elem.contractName === diffElem.contractName
    );

    const differingFields = _.xorWith(
      Object.entries(newHashesElem || {}),
      Object.entries(oldHashesElem || {}),
      _.isEqual
    );

    const differingFieldsUniqueKeys = _.uniq(
      differingFields.map(([key]) => key)
    );

    return {
      contract: diffElem.contractName,
      differingFields: differingFieldsUniqueKeys,
      old: oldHashesElem || {},
      new: newHashesElem || {},
    };
  });

  return differencesList;
};

const main = async () => {
  const args = process.argv;
  if (args.length > 3 || (args.length == 3 && !args.includes("--check-only"))) {
    console.log(
      "This command can be used with no arguments or with the --check-only flag. Use the --check-only flag to check the hashes without updating the SystemContractsHashes.json file."
    );
    process.exit(1);
  }
  const checkOnly = args.includes("--check-only");

  const newSystemContractsHashes = getSystemContractsHashes(
    SYSTEM_CONTRACTS_DETAILS
  );

  const oldSystemContractsHashes =
    readSystemContractsHashesFile(OUTPUT_FILE_PATH);

  if (_.isEqual(newSystemContractsHashes, oldSystemContractsHashes)) {
    console.log(
      "Calculated hashes match the hashes in the SystemContractsHashes.json file."
    );
    console.log("Exiting...");
    return;
  }

  const differences = findDifferences(
    newSystemContractsHashes,
    oldSystemContractsHashes
  );

  console.log(
    "Calculated hashes differ from the hashes in the SystemContractsHashes.json file. Differences:"
  );
  console.log(differences);

  if (checkOnly) {
    console.log(
      "You can use the `yarn calculate-hashes` command to update the SystemContractsHashes.json file."
    );
    console.log("Exiting...");
    process.exit(1);
  } else {
    console.log("Updating...");
    saveSystemContractsHashesFile(OUTPUT_FILE_PATH, newSystemContractsHashes);
    console.log("Update finished");
    console.log("Exiting...");
    return;
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err.message || err);
    console.log(
      "Please make sure to run `yarn build && yarn preprocess && yarn compile-yul` before running this script."
    );
    process.exit(1);
  });
