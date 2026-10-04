const hre = require("hardhat");

async function main() {
  const deployedAddresses = require("../frontend/src/utils/deployedAddresses.json");
  const fileRegistry = await hre.ethers.getContractAt("FileRegistry", deployedAddresses.fileRegistryAddress);
  const acAddress = await fileRegistry.accessControlContract();
  console.log("FileRegistry.accessControlContract =", acAddress);
  console.log("deployedAddresses.accessControlAddress =", deployedAddresses.accessControlAddress);
  
  const ac = await hre.ethers.getContractAt("BlockDriveAccessControl", acAddress);
  const docRole = await ac.DOCTOR_ROLE();
  const staffRole = await ac.MEDICAL_STAFF_ROLE();
  const patRole = await ac.PATIENT_ROLE();
  const target = "0xeb633150ac2e56fba7c950c64bd388040690b85b";
  
  console.log("Target:", target);
  console.log("Doctor:", await ac.hasRole(docRole, target));
  console.log("Medical Staff:", await ac.hasRole(staffRole, target));
  console.log("Patient:", await ac.hasRole(patRole, target));
  console.log("isVerifiedProvider:", await ac.isVerifiedProvider(target));

  if (!(await ac.hasRole(docRole, target))) {
    console.log("Granting DOCTOR_ROLE now...");
    const tx = await ac.onboardDoctor(target);
    await tx.wait();
    console.log("✓ DOCTOR_ROLE granted!");
    console.log("isVerifiedProvider now:", await ac.isVerifiedProvider(target));
  }
}

main().catch(console.error);
