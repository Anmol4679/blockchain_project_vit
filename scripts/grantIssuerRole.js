const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const targetAddress = process.env.TARGET_ADDRESS || "0x341df0d8f0304e5a74dd5dda166fac47bc1dc5de";
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Admin deployer account: ${deployer.address}`);

  const deployedAddressesFile = path.join(__dirname, "..", "frontend", "src", "utils", "deployedAddresses.json");
  const config = JSON.parse(fs.readFileSync(deployedAddressesFile, "utf-8"));
  const certificateRegistryAddress = config.certificateRegistryAddress;

  console.log(`CertificateRegistry at: ${certificateRegistryAddress}`);

  const CertificateRegistryFactory = await hre.ethers.getContractFactory("CertificateRegistry");
  const certificateRegistry = CertificateRegistryFactory.attach(certificateRegistryAddress);

  const ISSUER_ROLE = await certificateRegistry.ISSUER_ROLE();
  const hasRole = await certificateRegistry.hasRole(ISSUER_ROLE, targetAddress);

  if (hasRole) {
    console.log(`✓ Account ${targetAddress} already has ISSUER_ROLE.`);
  } else {
    console.log(`Granting ISSUER_ROLE to: ${targetAddress}...`);
    const tx = await certificateRegistry.grantRole(ISSUER_ROLE, targetAddress);
    await tx.wait();
    console.log(`✓ Successfully granted ISSUER_ROLE to ${targetAddress}!`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
