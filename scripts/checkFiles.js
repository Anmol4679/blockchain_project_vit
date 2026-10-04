const hre = require("hardhat");

async function main() {
  const deployedAddresses = require("../frontend/src/utils/deployedAddresses.json");
  const fileRegistry = await hre.ethers.getContractAt("FileRegistry", deployedAddresses.fileRegistryAddress);
  const owner = "0xeb633150ac2e56fba7c950c64bd388040690b85b";
  const files = await fileRegistry.getFilesByOwner(owner);
  console.log(`On-chain files count for ${owner}:`, files.length);
  for (let i = 0; i < files.length; i++) {
    const fileId = files[i];
    console.log(`File ${i}: ${fileId}`);
  }
}

main().catch(console.error);
