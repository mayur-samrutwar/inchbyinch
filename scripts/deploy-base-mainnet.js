const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying inchbyinch to Base mainnet...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient balance for deployment. Need at least 0.01 ETH");
  }

  // Base mainnet configuration
  const NETWORK_NAME = "Base";
  const CHAIN_ID = 8453;
  
  // Real LOP address (same as mainnet since Base is EVM compatible)
  const LOP_ADDRESS = "0x111111125421ca6dc452d289314280a0f8842a65"; // 1inch Aggregation Router V6
  
  // Base mainnet token addresses
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base WETH
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
  const DAI_ADDRESS = "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"; // Base DAI

  console.log("📋 Configuration:");
  console.log("- Network:", NETWORK_NAME);
  console.log("- Chain ID:", CHAIN_ID);
  console.log("- Deployer:", deployer.address);
  console.log("- LOP Address:", LOP_ADDRESS);
  console.log("- WETH Address:", WETH_ADDRESS);
  console.log("- USDC Address:", USDC_ADDRESS);
  console.log("- DAI Address:", DAI_ADDRESS);

  // Deploy core contracts
  console.log("\n🔧 Deploying core contracts...");

  // 1. Deploy OracleAdapter
  console.log("Deploying OracleAdapter...");
  const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
  const oracleAdapter = await OracleAdapter.deploy();
  await oracleAdapter.waitForDeployment();
  console.log("✅ OracleAdapter deployed to:", await oracleAdapter.getAddress());

  // 2. Deploy OrderManager
  console.log("Deploying OrderManager...");
  const OrderManager = await ethers.getContractFactory("OrderManager");
  const orderManager = await OrderManager.deploy();
  await orderManager.waitForDeployment();
  console.log("✅ OrderManager deployed to:", await orderManager.getAddress());

  // 3. Deploy LOPAdapter
  console.log("Deploying LOPAdapter...");
  const LOPAdapter = await ethers.getContractFactory("LOPAdapter");
  const lopAdapter = await LOPAdapter.deploy(LOP_ADDRESS);
  await lopAdapter.waitForDeployment();
  console.log("✅ LOPAdapter deployed to:", await lopAdapter.getAddress());

  // 4. Deploy Bot Implementation
  console.log("Deploying Bot Implementation...");
  const InchbyinchBot = await ethers.getContractFactory("inchbyinchBot");
  const botImplementation = await InchbyinchBot.deploy();
  await botImplementation.waitForDeployment();
  console.log("✅ Bot Implementation deployed to:", await botImplementation.getAddress());

  // 5. Deploy Factory
  console.log("Deploying Factory...");
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
    network: "base",
    chainId: CHAIN_ID,
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
      usdc: USDC_ADDRESS,
      dai: DAI_ADDRESS
    },
    timestamp: new Date().toISOString()
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require('fs');
  fs.writeFileSync('deployment-base-mainnet.json', JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to deployment-base-mainnet.json");

  console.log("\n🎉 Base mainnet deployment completed successfully!");
  console.log("🔗 Factory Address:", await factory.getAddress());
  console.log("🔗 Test Bot Address:", botAddress);
  console.log("\n💡 Next steps:");
  console.log("1. Verify contracts on Base block explorer");
  console.log("2. Test with real tokens on Base");
  console.log("3. Monitor gas usage and performance");
  console.log("4. Deploy frontend to connect to Base");
  console.log("5. Consider deploying to Ethereum mainnet");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 