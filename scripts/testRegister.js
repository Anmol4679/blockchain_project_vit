const hre = require("hardhat");

async function main() {
  const deployedAddresses = require("../frontend/src/utils/deployedAddresses.json");
  const fileRegistry = await hre.ethers.getContractAt("FileRegistry", deployedAddresses.fileRegistryAddress);
  const signer = await hre.ethers.getImpersonatedSigner("0xeb633150ac2e56fba7c950c64bd388040690b85b");

  const testFileId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test-upload-" + Date.now()));
  const testCid = "QmTestCid" + Date.now();
  const testKey = hre.ethers.toUtf8Bytes("test-wrapped-key-payload");

  console.log("Testing registerFile from 0xeb633150ac2e56fba7c950c64bd388040690b85b...");
  const tx = await fileRegistry.connect(signer).registerFile(testFileId, testCid, testKey);
  const receipt = await tx.wait();
  console.log("✓ Transaction SUCCESSFUL! Hash:", receipt.hash, "Block:", receipt.blockNumber);
}

main().catch(console.error);
