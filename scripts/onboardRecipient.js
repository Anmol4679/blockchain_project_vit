const hre = require("hardhat");

async function main() {
  const deployedAddresses = require("../frontend/src/utils/deployedAddresses.json");
  const accessControl = await hre.ethers.getContractAt(
    "BlockDriveAccessControl",
    deployedAddresses.accessControlAddress
  );

  const rawTarget = process.env.TARGET || "0x34602ebc6f5643fbe69edc725da2e5fd5c1c6606";
  const target = hre.ethers.getAddress(rawTarget.toLowerCase());
  const doctorRole = await accessControl.DOCTOR_ROLE();
  const staffRole = await accessControl.MEDICAL_STAFF_ROLE();
  const patientRole = await accessControl.PATIENT_ROLE();

  console.log("Checking roles for:", target);
  console.log("Is Doctor:", await accessControl.hasRole(doctorRole, target));
  console.log("Is Medical Staff:", await accessControl.hasRole(staffRole, target));
  console.log("Is Patient:", await accessControl.hasRole(patientRole, target));

  if (!(await accessControl.hasRole(patientRole, target)) && !(await accessControl.hasRole(doctorRole, target))) {
    console.log("Onboarding target as Patient...");
    const tx = await accessControl.onboardPatient(target);
    await tx.wait();
    console.log("✓ Successfully onboarded target as Patient!");
  }
}

main().catch(console.error);
