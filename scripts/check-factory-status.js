const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking factory contract status...");

  // Factory address from latest deployment
  const FACTORY_ADDRESS = "0x945b1D2f67AaAd9b5130434D770eCF50235EE416";

  try {
    // Get factory contract
    const Factory = await ethers.getContractFactory("inchbyinchFactory");
    const factory = Factory.attach(FACTORY_ADDRESS);
    
    // Check if contract is paused
    const isPaused = await factory.paused();
    console.log("✅ Factory paused status:", isPaused);
    
    // Check owner
    const owner = await factory.owner();
    console.log("✅ Factory owner:", owner);
    
    // Check if we can call deployBot (this will fail if paused)
    try {
      const [deployer] = await ethers.getSigners();
      console.log("Testing deployBot with account:", deployer.address);
      
      // Try to simulate deployBot call
      const { request } = await factory.deployBot.populateTransaction(deployer.address, { value: ethers.parseEther("0.001") });
      console.log("✅ deployBot simulation successful - contract is not paused");
    } catch (error) {
      console.log("❌ deployBot simulation failed:", error.message);
      if (error.message.includes("OwnableUnauthorizedAccount")) {
        console.log("This suggests the contract is paused or has access control issues");
      }
    }
    
  } catch (error) {
    console.error("❌ Error checking factory:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 