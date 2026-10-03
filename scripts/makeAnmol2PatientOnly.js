const hre = require("hardhat");

async function main() {
  const targetUser = "0xeb633150ac2e56fba7c950c64bd388040690b85b";
  const [deployer] = await hre.ethers.getSigners();
  const deployedAddresses = require("../frontend/src/utils/deployedAddresses.json");
  const accessControl = await hre.ethers.getContractAt(
    "BlockDriveAccessControl",
    deployedAddresses.accessControlAddress
  );
  const certRegistry = await hre.ethers.getContractAt(
    "CertificateRegistry",
    deployedAddresses.certificateRegistryAddress
  );

  const adminRole = await accessControl.DEFAULT_ADMIN_ROLE();
  const doctorRole = await accessControl.DOCTOR_ROLE();
  const staffRole = await accessControl.MEDICAL_STAFF_ROLE();
  const patientRole = await accessControl.PATIENT_ROLE();
  const issuerRole = await certRegistry.ISSUER_ROLE();

  // Revoke all other roles from targetUser
  if (await accessControl.hasRole(adminRole, targetUser)) {
    await accessControl.revokeRole(adminRole, targetUser);
  }
  if (await accessControl.hasRole(doctorRole, targetUser)) {
    await accessControl.revokeRole(doctorRole, targetUser);
  }
  if (await accessControl.hasRole(staffRole, targetUser)) {
    await accessControl.revokeRole(staffRole, targetUser);
  }
  if (await certRegistry.hasRole(issuerRole, targetUser)) {
    await certRegistry.revokeRole(issuerRole, targetUser);
  }

  // Grant ONLY PATIENT_ROLE
  if (!(await accessControl.hasRole(patientRole, targetUser))) {
    await accessControl.onboardPatient(targetUser);
  }

  console.log("Account 0xeb63... is now strictly a PATIENT (hasRole patient = true, doctor = false, staff = false, admin = false)");
}

main().catch(console.error);
