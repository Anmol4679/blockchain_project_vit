const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [admin] = await hre.ethers.getSigners();
  console.log(`\n======================================================`);
  console.log(`Executing Healthcare Role Seeding on Network: ${hre.network.name}`);
  console.log(`Administrator Account: ${admin.address}`);
  console.log(`======================================================\n`);

  // 1. Resolve deployed BlockDriveAccessControl contract address
  const deployedAddressesFile = path.join(
    __dirname,
    "..",
    "frontend",
    "src",
    "utils",
    "deployedAddresses.json"
  );

  if (!fs.existsSync(deployedAddressesFile)) {
    throw new Error(
      `Deployment addresses file not found at: ${deployedAddressesFile}\nPlease deploy contracts first.`
    );
  }

  const deployedConfig = JSON.parse(fs.readFileSync(deployedAddressesFile, "utf-8"));
  const accessControlAddress = deployedConfig.accessControlAddress;

  if (!accessControlAddress) {
    throw new Error("Missing 'accessControlAddress' in deployedAddresses.json.");
  }

  console.log(`Target BlockDriveAccessControl: ${accessControlAddress}\n`);

  // 2. Load role configuration JSON
  const configFile = path.join(__dirname, "healthcare-roles.config.json");
  if (!fs.existsSync(configFile)) {
    throw new Error(`Configuration file not found at: ${configFile}`);
  }

  const roleEntries = JSON.parse(fs.readFileSync(configFile, "utf-8"));
  if (!Array.isArray(roleEntries) || roleEntries.length === 0) {
    console.log("No role entries found in configuration file. Exiting.");
    return;
  }

  // 3. Attach to deployed BlockDriveAccessControl contract
  const AccessControlFactory = await hre.ethers.getContractFactory("BlockDriveAccessControl");
  const accessControl = AccessControlFactory.attach(accessControlAddress);

  const DOCTOR_ROLE = await accessControl.DOCTOR_ROLE();
  const MEDICAL_STAFF_ROLE = await accessControl.MEDICAL_STAFF_ROLE();
  const PATIENT_ROLE = await accessControl.PATIENT_ROLE();

  const results = [];

  // 4. Process each entry idempotently
  for (const entry of roleEntries) {
    const rawAddress = entry.address;
    const roleKey = (entry.role || "").trim().toLowerCase();
    const description = entry.description || "N/A";

    let checksumAddress;
    try {
      checksumAddress = hre.ethers.getAddress(rawAddress);
    } catch {
      results.push({
        Address: rawAddress,
        Role: entry.role,
        Status: "Failed",
        Details: "Invalid Ethereum address",
      });
      continue;
    }

    let roleHash;
    let onboardFunctionName;

    if (roleKey === "doctor") {
      roleHash = DOCTOR_ROLE;
      onboardFunctionName = "onboardDoctor";
    } else if (roleKey === "medicalstaff" || roleKey === "medical_staff") {
      roleHash = MEDICAL_STAFF_ROLE;
      onboardFunctionName = "onboardMedicalStaff";
    } else if (roleKey === "patient") {
      roleHash = PATIENT_ROLE;
      onboardFunctionName = "onboardPatient";
    } else {
      results.push({
        Address: checksumAddress,
        Role: entry.role,
        Status: "Failed",
        Details: `Unsupported role: ${entry.role}`,
      });
      continue;
    }

    // Check if account already possesses the role
    const alreadyHasRole = await accessControl.hasRole(roleHash, checksumAddress);

    if (alreadyHasRole) {
      results.push({
        Address: checksumAddress,
        Role: entry.role,
        Status: "Skipped",
        Details: "Role already granted",
      });
      continue;
    }

    try {
      console.log(`Granting ${entry.role} to ${checksumAddress} (${description})...`);
      const tx = await accessControl[onboardFunctionName](checksumAddress);
      await tx.wait();

      results.push({
        Address: checksumAddress,
        Role: entry.role,
        Status: "Granted",
        Details: `Tx: ${tx.hash.substring(0, 10)}...`,
      });
    } catch (err) {
      results.push({
        Address: checksumAddress,
        Role: entry.role,
        Status: "Failed",
        Details: err.message || "Execution reverted",
      });
    }
  }

  // 5. Output summary table
  console.log("\n================ Healthcare Role Seeding Summary ================");
  console.table(results);
  console.log("=================================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Role seeding error:", error);
    process.exit(1);
  });
