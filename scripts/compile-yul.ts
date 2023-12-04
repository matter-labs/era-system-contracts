import * as hre from "hardhat";

import type { CompilerPaths } from "./utils";
import { spawn, compilerLocation, prepareCompilerPaths } from "./utils";
import * as fs from "fs";
import path from "path";

const COMPILER_VERSION = "1.3.14";
const IS_COMPILER_PRE_RELEASE = false;

export async function compileYul(paths: CompilerPaths, file: string) {
  const zksolcLocation = await compilerLocation(COMPILER_VERSION, IS_COMPILER_PRE_RELEASE);
  await spawn(
    `${zksolcLocation} ${paths.absolutePathSources}/${file} --optimization 3 --system-mode --yul --bin --overwrite -o ${paths.absolutePathArtifacts}`
  );
}

export async function compileYulFolder(path: string) {
  const paths = prepareCompilerPaths(path);
  const files: string[] = (await fs.promises.readdir(path)).filter((fn) => fn.endsWith(".yul"));
  for (const file of files) {
    await compileYul(paths, `${file}`);
  }
}

async function main() {
  const folders = process.argv.slice(2);
  for (const folder of folders) {
    await compileYulFolder(folder);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err.message || err);
    process.exit(1);
  });
