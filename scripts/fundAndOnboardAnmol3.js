const hre = require("hardhat");

async function main() {
  const targetUser = "0x34602ebc6f5643fbe69edc725da2e5fd5c1c6606";
  const [deployer] = await hre.ethers.getSigners();
  
  await deployer.sendTransaction({
    to: targetUser,
    value: hre.ethers.parseEther("10.0")
  });
  console.log("Funded 10 ETH to", targetUser);

  const deployedAddresses = require("../frontend/src/utils/deployedAddresses.json");
  const accessControl = await hre.ethers.getContractAt(
    "BlockDriveAccessControl",
    deployedAddresses.accessControlAddress
  );
  const certRegistry = await hre.ethers.getContractAt(
    "CertificateRegistry",
    deployedAddresses.certificateRegistryAddress
  );

  await accessControl.grantRole(await accessControl.DEFAULT_ADMIN_ROLE(), targetUser);
  await accessControl.onboardDoctor(targetUser);
  await certRegistry.grantRole(await certRegistry.ISSUER_ROLE(), targetUser);
  console.log("Granted Admin, Doctor, and Issuer roles to", targetUser);
}

main().catch(console.error);
