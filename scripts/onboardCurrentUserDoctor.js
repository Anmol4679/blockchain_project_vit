const hre = require("hardhat");

async function main() {
  const targetUser = "0xeb633150ac2e56fba7c950c64bd388040690b85b";
  const [deployer] = await hre.ethers.getSigners();
  const deployedAddresses = require("../frontend/src/utils/deployedAddresses.json");
  const accessControl = await hre.ethers.getContractAt(
    "BlockDriveAccessControl",
    deployedAddresses.accessControlAddress
  );

  const tx = await accessControl.onboardDoctor(targetUser);
  await tx.wait();
  console.log("Onboarded doctor:", targetUser);
}

main().catch(console.error);
