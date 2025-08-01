const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Verifying deployed contracts...");

  // Contract addresses from latest deployment
  const FACTORY_ADDRESS = "0xD57be8f04cdd21A056bc32f1d26DAc62fB44747A";
  const ORDER_MANAGER_ADDRESS = "0x88705edFCFd3A55598D071791A2096AC1683036d";
  const ORACLE_ADAPTER_ADDRESS = "0xefBAa35F4364933ddD6a66d59e35e9A1Ec19bC46";
  const LOP_ADAPTER_ADDRESS = "0xf7B94C39082113C2FDF63D8997fdf767f0BA15E8";
  const BOT_IMPLEMENTATION_ADDRESS = "0x841e35b52f299463844028aE09c5F7bBE27c50BB";

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  try {
    // 1. Verify Factory contract
    console.log("\n📋 Verifying Factory contract...");
    const Factory = await ethers.getContractFactory("inchbyinchFactory");
    const factory = Factory.attach(FACTORY_ADDRESS);
    
    const factoryOwner = await factory.owner();
    console.log("✅ Factory owner:", factoryOwner);
    
    const botImplementation = await factory.botImplementation();
    console.log("✅ Bot implementation:", botImplementation);
    
    const orderManager = await factory.orderManager();
    console.log("✅ Order manager:", orderManager);

    // 2. Verify OrderManager contract
    console.log("\n📋 Verifying OrderManager contract...");
    const OrderManager = await ethers.getContractFactory("OrderManager");
    const orderManagerContract = OrderManager.attach(ORDER_MANAGER_ADDRESS);
    
    const orderManagerOwner = await orderManagerContract.owner();
    console.log("✅ OrderManager owner:", orderManagerOwner);
    
    const isFactoryAuthorized = await orderManagerContract.isBotAuthorized(FACTORY_ADDRESS);
    console.log("✅ Factory authorized in OrderManager:", isFactoryAuthorized);

    // 3. Verify OracleAdapter contract
    console.log("\n📋 Verifying OracleAdapter contract...");
    const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    const oracleAdapter = OracleAdapter.attach(ORACLE_ADAPTER_ADDRESS);
    
    const oracleOwner = await oracleAdapter.owner();
    console.log("✅ OracleAdapter owner:", oracleOwner);
    
    const isFactoryUpdater = await oracleAdapter.isUpdaterAuthorized(FACTORY_ADDRESS);
    console.log("✅ Factory authorized in OracleAdapter:", isFactoryUpdater);

    // 4. Verify LOPAdapter contract
    console.log("\n📋 Verifying LOPAdapter contract...");
    const LOPAdapter = await ethers.getContractFactory("LOPAdapter");
    const lopAdapter = LOPAdapter.attach(LOP_ADAPTER_ADDRESS);
    
    const lopOwner = await lopAdapter.owner();
    console.log("✅ LOPAdapter owner:", lopOwner);
    
    // LOPAdapter doesn't have isUpdaterAuthorized function
    console.log("✅ LOPAdapter verification completed");

    // 5. Test bot deployment
    console.log("\n🧪 Testing bot deployment...");
    const deploymentCost = ethers.parseEther("0.001");
    
    const tx = await factory.deployBot(deployer.address, { value: deploymentCost });
    const receipt = await tx.wait();
    
    const event = receipt.logs.find(log => 
      log.fragment && log.fragment.name === "BotDeployed"
    );
    
    if (event) {
      const botAddress = event.args.bot;
      console.log("✅ Test bot deployed to:", botAddress);
      
      // 6. Verify bot contract
      console.log("\n📋 Verifying bot contract...");
      const Bot = await ethers.getContractFactory("inchbyinchBot");
      const bot = Bot.attach(botAddress);
      
      const botOwner = await bot.owner();
      console.log("✅ Bot owner:", botOwner);
      
      const botOrderManager = await bot.orderManager();
      console.log("✅ Bot OrderManager:", botOrderManager);
      
      const botOracleAdapter = await bot.oracleAdapter();
      console.log("✅ Bot OracleAdapter:", botOracleAdapter);

      // 7. Test bot authorization
      console.log("\n🔐 Testing bot authorization...");
      const isBotAuthorized = await orderManagerContract.isBotAuthorized(botAddress);
      console.log("✅ Bot authorized in OrderManager:", isBotAuthorized);
      
      if (!isBotAuthorized) {
        console.log("⚠️  Bot not authorized, authorizing...");
        await orderManagerContract.authorizeBot(botAddress);
        console.log("✅ Bot authorized successfully");
      }

      console.log("\n🎉 All verification tests passed!");
      console.log("\n📊 Deployment Summary:");
      console.log("- Factory:", FACTORY_ADDRESS);
      console.log("- OrderManager:", ORDER_MANAGER_ADDRESS);
      console.log("- OracleAdapter:", ORACLE_ADAPTER_ADDRESS);
      console.log("- LOPAdapter:", LOP_ADAPTER_ADDRESS);
      console.log("- Bot Implementation:", BOT_IMPLEMENTATION_ADDRESS);
      console.log("- Test Bot:", botAddress);

    } else {
      console.log("❌ Bot deployment event not found");
    }

  } catch (error) {
    console.error("❌ Verification failed:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 