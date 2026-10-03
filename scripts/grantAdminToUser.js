const hre = require("hardhat");

async function main() {
  const targetUser = "0xeb633150ac2e56fba7c950c64bd388040690b85b";
  const [deployer] = await hre.ethers.getSigners();
  console.log("Admin deployer:", deployer.address);

  // Fund the user account with 10 ETH for gas
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

  const adminRole = await accessControl.DEFAULT_ADMIN_ROLE();
  const tx1 = await accessControl.grantRole(adminRole, targetUser);
  await tx1.wait();
  console.log("Granted DEFAULT_ADMIN_ROLE to", targetUser);

  const certRegistry = await hre.ethers.getContractAt(
    "CertificateRegistry",
    deployedAddresses.certificateRegistryAddress
  );
  const issuerRole = await certRegistry.ISSUER_ROLE();
  const tx2 = await certRegistry.grantRole(issuerRole, targetUser);
  await tx2.wait();
  console.log("Granted ISSUER_ROLE on CertificateRegistry to", targetUser);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
