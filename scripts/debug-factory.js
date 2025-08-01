const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debugging factory contract...");

  const FACTORY_ADDRESS = "0x943d0b36bE3c57FAd833c112e948be94B73F2D6c";

  try {
    const Factory = await ethers.getContractFactory("inchbyinchFactory");
    const factory = Factory.attach(FACTORY_ADDRESS);
    
    const [deployer] = await ethers.getSigners();
    
    // Check basic contract state
    console.log("Checking contract state...");
    const isPaused = await factory.paused();
    console.log("Paused:", isPaused);
    
    const owner = await factory.owner();
    console.log("Owner:", owner);
    
    const botImplementation = await factory.botImplementation();
    console.log("Bot Implementation:", botImplementation);
    
    const orderManager = await factory.orderManager();
    console.log("Order Manager:", orderManager);
    
    const oracleAdapter = await factory.oracleAdapter();
    console.log("Oracle Adapter:", oracleAdapter);
    
    const lop = await factory.lop();
    console.log("LOP:", lop);
    
    const lopAdapter = await factory.lopAdapter();
    console.log("LOP Adapter:", lopAdapter);
    
    // Check user bots
    const userBots = await factory.getUserBots(deployer.address);
    console.log("User bots:", userBots);
    
    // Try to simulate the exact call that's failing
    console.log("\nSimulating deployBot call...");
    try {
      const { request } = await factory.deployBot.populateTransaction(
        deployer.address, 
        { value: ethers.parseEther("0.001") }
      );
      console.log("✅ Simulation successful");
      console.log("Request:", request);
    } catch (error) {
      console.log("❌ Simulation failed:", error.message);
      
      // Try to get more details about the error
      if (error.data) {
        console.log("Error data:", error.data);
      }
    }
    
  } catch (error) {
    console.error("❌ Error debugging factory:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 