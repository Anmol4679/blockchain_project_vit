const hre = require("hardhat");

async function main() {
  const targetAddress = process.env.TARGET_ADDRESS || "0x341df0d8f0304e5a74dd5dda166fac47bc1dc5de";

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Sending 100 ETH from deployer (${deployer.address}) to: ${targetAddress}`);

  const tx = await deployer.sendTransaction({
    to: targetAddress,
    value: hre.ethers.parseEther("100.0"),
  });
  await tx.wait();

  const balance = await hre.ethers.provider.getBalance(targetAddress);
  console.log(`✓ Successfully funded! New balance of ${targetAddress}: ${hre.ethers.formatEther(balance)} ETH`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
