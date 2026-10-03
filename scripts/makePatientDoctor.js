const hre = require("hardhat");

async function main() {
  const localProvider = new hre.ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const adminSigner = new hre.ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    localProvider
  );
  
  const deployedAddresses = require("../frontend/src/utils/deployedAddresses.json");
  const accessControl = await hre.ethers.getContractAt(
    "BlockDriveAccessControl",
    deployedAddresses.accessControlAddress,
    adminSigner
  );

  const targetAccount = "0xeb633150ac2e56fba7c950c64bd388040690b85b";
  
  // Make patient a doctor:
  const doctorRole = await accessControl.DOCTOR_ROLE();
  const patientRole = await accessControl.PATIENT_ROLE();
  const staffRole = await accessControl.MEDICAL_STAFF_ROLE();

  if (await accessControl.hasRole(patientRole, targetAccount)) {
    const txRevoke = await accessControl.revokeHealthcareRole(targetAccount, patientRole);
    await txRevoke.wait();
    console.log("Revoked patient role");
  }

  const txDoctor = await accessControl.onboardDoctor(targetAccount);
  await txDoctor.wait();
  console.log("Successfully onboarded", targetAccount, "as DOCTOR!");
}

main().catch(console.error);
