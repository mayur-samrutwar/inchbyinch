const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing bot deployment...");

  // Factory address from latest deployment
  const FACTORY_ADDRESS = "0x943d0b36bE3c57FAd833c112e948be94B73F2D6c";

  try {
    // Get factory contract
    const Factory = await ethers.getContractFactory("inchbyinchFactory");
    const factory = Factory.attach(FACTORY_ADDRESS);
    
    const [deployer] = await ethers.getSigners();
    console.log("Using deployer account:", deployer.address);
    
    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "ETH");
    
    // Try to deploy a bot
    console.log("Deploying bot...");
    const tx = await factory.deployBot(deployer.address, { value: ethers.parseEther("0.001") });
    console.log("Transaction hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed!");
    
    // Get the deployed bot address from events
    const event = receipt.logs.find(log => 
      log.fragment && log.fragment.name === "BotDeployed"
    );
    
    if (event) {
      const botAddress = event.args.bot;
      console.log("✅ Bot deployed successfully to:", botAddress);
      
      // Test bot functionality
      const Bot = await ethers.getContractFactory("inchbyinchBot");
      const bot = Bot.attach(botAddress);
      
      const botOwner = await bot.owner();
      console.log("Bot owner:", botOwner);
      
      // Check if bot is authorized in OrderManager
      const orderManagerAddress = await bot.orderManager();
      console.log("OrderManager address:", orderManagerAddress);
      
      const OrderManager = await ethers.getContractFactory("OrderManager");
      const orderManager = OrderManager.attach(orderManagerAddress);
      
      const isAuthorized = await orderManager.isBotAuthorized(botAddress);
      console.log("Bot authorized in OrderManager:", isAuthorized);
      
    } else {
      console.log("❌ Bot deployment event not found");
    }
    
  } catch (error) {
    console.error("❌ Error deploying bot:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 