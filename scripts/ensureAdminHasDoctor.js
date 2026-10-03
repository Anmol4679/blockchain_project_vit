const hre = require("hardhat");

async function main() {
  const accounts = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0xeb633150ac2e56fba7c950c64bd388040690b85b"
  ];
  
  const deployedAddresses = require("../frontend/src/utils/deployedAddresses.json");
  const accessControl = await hre.ethers.getContractAt(
    "BlockDriveAccessControl",
    deployedAddresses.accessControlAddress
  );
  const certRegistry = await hre.ethers.getContractAt(
    "CertificateRegistry",
    deployedAddresses.certificateRegistryAddress
  );
  
  const doctorRole = await accessControl.DOCTOR_ROLE();
  const issuerRole = await certRegistry.ISSUER_ROLE();

  for (const acc of accounts) {
    if (!(await accessControl.hasRole(doctorRole, acc))) {
      const tx = await accessControl.onboardDoctor(acc);
      await tx.wait();
      console.log("Granted DOCTOR_ROLE to", acc);
    }
    if (!(await certRegistry.hasRole(issuerRole, acc))) {
      const tx = await certRegistry.grantRole(issuerRole, acc);
      await tx.wait();
      console.log("Granted ISSUER_ROLE to", acc);
    }
  }
}

main().catch(console.error);
