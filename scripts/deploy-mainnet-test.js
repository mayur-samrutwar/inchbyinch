const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying inchbyinch to mainnet for testing...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Real mainnet addresses
  const LOP_ADDRESS = "0x111111125421ca6dc452d289314280a0f8842a65"; // 1inch Aggregation Router V6
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDC_ADDRESS = "0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8C8";

  console.log("📋 Configuration:");
  console.log("- LOP Address:", LOP_ADDRESS);
  console.log("- WETH Address:", WETH_ADDRESS);
  console.log("- USDC Address:", USDC_ADDRESS);
  console.log("- Deployer:", deployer.address);

  // Deploy core contracts
  console.log("\n🔧 Deploying core contracts...");

  const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
  const oracleAdapter = await OracleAdapter.deploy();
  await oracleAdapter.waitForDeployment();
  console.log("✅ OracleAdapter deployed to:", await oracleAdapter.getAddress());

  const OrderManager = await ethers.getContractFactory("OrderManager");
  const orderManager = await OrderManager.deploy();
  await orderManager.waitForDeployment();
  console.log("✅ OrderManager deployed to:", await orderManager.getAddress());

  const LOPAdapter = await ethers.getContractFactory("LOPAdapter");
  const lopAdapter = await LOPAdapter.deploy(LOP_ADDRESS);
  await lopAdapter.waitForDeployment();
  console.log("✅ LOPAdapter deployed to:", await lopAdapter.getAddress());

  const InchbyinchBot = await ethers.getContractFactory("inchbyinchBot");
  const botImplementation = await InchbyinchBot.deploy();
  await botImplementation.waitForDeployment();
  console.log("✅ Bot Implementation deployed to:", await botImplementation.getAddress());

  const InchbyinchFactory = await ethers.getContractFactory("inchbyinchFactory");
  const factory = await InchbyinchFactory.deploy(
    await botImplementation.getAddress(),
    await orderManager.getAddress(),
    await oracleAdapter.getAddress(),
    LOP_ADDRESS,
    await lopAdapter.getAddress()
  );
  await factory.waitForDeployment();
  console.log("✅ Factory deployed to:", await factory.getAddress());

  // Setup contracts
  console.log("\n🔐 Setting up contract permissions...");
  
  await orderManager.authorizeBot(await factory.getAddress());
  console.log("✅ Factory authorized in OrderManager");

  await oracleAdapter.authorizeUpdater(await factory.getAddress());
  console.log("✅ Factory authorized in OracleAdapter");

  await lopAdapter.authorizeUpdater(await factory.getAddress());
  console.log("✅ Factory authorized in LOPAdapter");

  // Test deployment
  console.log("\n🧪 Testing bot deployment...");
  
  const deploymentCost = ethers.parseEther("0.01");
  const tx = await factory.deployBot(deployer.address, { value: deploymentCost });
  const receipt = await tx.wait();
  
  const event = receipt.logs.find(log => log.fragment && log.fragment.name === "BotDeployed");
  const botAddress = event.args.bot;
  console.log("✅ Test bot deployed to:", botAddress);

  // Test strategy creation
  console.log("\n📊 Testing strategy creation...");
  
  const bot = await ethers.getContractAt("inchbyinchBot", botAddress);
  
  // Authorize the bot
  await orderManager.authorizeBot(botAddress);
  await lopAdapter.authorizeUpdater(botAddress);

  // Create a test strategy
  await bot.createStrategy(
    WETH_ADDRESS, // WETH
    USDC_ADDRESS, // USDC
    ethers.parseEther("3000"), // startPrice: $3000
    50, // spacing: 50%
    ethers.parseEther("0.01"), // orderSize: 0.01 WETH
    3, // numOrders
    0, // strategyType: BUY_LADDER
    1, // repostMode: REPOST_SAME
    ethers.parseUnits("100", 6), // budget: 100 USDC
    ethers.parseEther("2500"), // stopLoss: $2500
    ethers.parseEther("3500"), // takeProfit: $3500
    Math.floor(Date.now() / 1000) + 3600, // expiryTime: 1 hour
    false, // flipToSell: disabled
    0 // flipPercentage: 0%
  );
  console.log("✅ Test strategy created successfully");

  // Verify strategy
  const strategy = await bot.strategy();
  console.log("📋 Strategy details:");
  console.log("- Maker Asset:", strategy.makerAsset);
  console.log("- Taker Asset:", strategy.takerAsset);
  console.log("- Start Price:", ethers.formatEther(strategy.startPrice));
  console.log("- Is Active:", strategy.isActive);

  // Save deployment info
  const deploymentInfo = {
    network: "mainnet",
    deployer: deployer.address,
    contracts: {
      oracleAdapter: await oracleAdapter.getAddress(),
      orderManager: await orderManager.getAddress(),
      lopAdapter: await lopAdapter.getAddress(),
      botImplementation: await botImplementation.getAddress(),
      factory: await factory.getAddress(),
      testBot: botAddress
    },
    external: {
      lop: LOP_ADDRESS,
      weth: WETH_ADDRESS,
      usdc: USDC_ADDRESS
    },
    timestamp: new Date().toISOString()
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎉 Mainnet deployment completed successfully!");
  console.log("🔗 Factory Address:", await factory.getAddress());
  console.log("🔗 Test Bot Address:", botAddress);
  console.log("\n💡 Next steps:");
  console.log("1. Verify contracts on Etherscan");
  console.log("2. Test with real tokens");
  console.log("3. Monitor gas usage");
  console.log("4. Deploy frontend");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 