const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Simple bot deployment test on Base Sepolia...");

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Use existing factory
  const FACTORY_ADDRESS = "0xEB100be17c1d4Ea03E8AA8a017A5063955172c5D";
  const factory = await ethers.getContractAt("inchbyinchFactory", FACTORY_ADDRESS);
  
  console.log("📋 Using existing factory:", FACTORY_ADDRESS);

  // Deploy a simple bot
  console.log("\n🧪 Deploying bot...");
  
  const deploymentCost = ethers.parseEther("0.001");
  const tx = await factory.deployBot(deployer.address, { value: deploymentCost });
  const receipt = await tx.wait();
  
  const event = receipt.logs.find(log => log.fragment && log.fragment.name === "BotDeployed");
  const botAddress = event.args.bot;
  console.log("✅ Bot deployed to:", botAddress);

  // Test basic bot functionality
  console.log("\n📊 Testing basic bot functionality...");
  
  const bot = await ethers.getContractAt("inchbyinchBot", botAddress);
  
  // Check if bot is initialized
  try {
    const owner = await bot.owner();
    console.log("✅ Bot owner:", owner);
    console.log("✅ Bot is properly initialized");
  } catch (error) {
    console.log("❌ Bot initialization check failed:", error.message);
  }

  // Check bot balance
  try {
    const botBalance = await ethers.provider.getBalance(botAddress);
    console.log("✅ Bot balance:", ethers.formatEther(botBalance), "ETH");
  } catch (error) {
    console.log("❌ Bot balance check failed:", error.message);
  }

  console.log("\n🎉 Basic bot deployment test completed!");
  console.log("🔗 Factory Address:", FACTORY_ADDRESS);
  console.log("🔗 Bot Address:", botAddress);
  console.log("💰 Cost: 0.001 ETH deposit + gas");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }); 