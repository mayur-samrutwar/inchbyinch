const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying inchbyinch to Base Sepolia testnet...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient balance for deployment. Need at least 0.01 ETH");
  }

  // Base Sepolia configuration
  const NETWORK_NAME = "Base Sepolia";
  const CHAIN_ID = 84532;
  
  // Mock LOP for testnet (since real LOP is mainnet only)
  const MOCK_LOP_ADDRESS = "0x0000000000000000000000000000000000000000"; // Will deploy MockLOP
  
  // Testnet token addresses (if available, otherwise we'll use mock tokens)
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base Sepolia WETH
  const USDC_ADDRESS = "0x036cbd53842c5426634e7929541ec2318f3dcf7e"; // Temporarily using WETH for testing

  console.log("📋 Configuration:");
  console.log("- Network:", NETWORK_NAME);
  console.log("- Chain ID:", CHAIN_ID);
  console.log("- Deployer:", deployer.address);
  console.log("- WETH Address:", WETH_ADDRESS);
  console.log("- USDC Address:", USDC_ADDRESS);

  // Deploy core contracts
  console.log("\n🔧 Deploying core contracts...");

  // Declare variables outside the if-else block
  let mockLOP, oracleAdapter, orderManager, lopAdapter, botImplementation;

  // Check if we already have deployed contracts (optional - for testing)
  const existingFactoryAddress = process.env.EXISTING_FACTORY_ADDRESS;
  if (existingFactoryAddress && existingFactoryAddress !== "0x0000000000000000000000000000000000000000") {
    console.log("📋 Using existing factory address:", existingFactoryAddress);
    factory = await ethers.getContractAt("inchbyinchFactory", existingFactoryAddress);
    console.log("✅ Using existing factory");
  } else {
    // 1. Deploy MockLOP (since real LOP is mainnet only)
    console.log("Deploying MockLOP...");
    const MockLOP = await ethers.getContractFactory("MockLOP");
    mockLOP = await MockLOP.deploy();
    await mockLOP.waitForDeployment();
    console.log("✅ MockLOP deployed to:", await mockLOP.getAddress());

    // Add delay between deployments
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Deploy OracleAdapter
    console.log("Deploying OracleAdapter...");
    const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    oracleAdapter = await OracleAdapter.deploy();
    await oracleAdapter.waitForDeployment();
    console.log("✅ OracleAdapter deployed to:", await oracleAdapter.getAddress());

    // Add delay between deployments
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Deploy OrderManager
    console.log("Deploying OrderManager...");
    const OrderManager = await ethers.getContractFactory("OrderManager");
    orderManager = await OrderManager.deploy();
    await orderManager.waitForDeployment();
    console.log("✅ OrderManager deployed to:", await orderManager.getAddress());

    // Add delay between deployments
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. Deploy LOPAdapter
    console.log("Deploying LOPAdapter...");
    const LOPAdapter = await ethers.getContractFactory("LOPAdapter");
    lopAdapter = await LOPAdapter.deploy(await mockLOP.getAddress());
    await lopAdapter.waitForDeployment();
    console.log("✅ LOPAdapter deployed to:", await lopAdapter.getAddress());

    // Add delay between deployments
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Deploy Bot Implementation
    console.log("Deploying Bot Implementation...");
    const InchbyinchBot = await ethers.getContractFactory("inchbyinchBot");
    botImplementation = await InchbyinchBot.deploy();
    await botImplementation.waitForDeployment();
    console.log("✅ Bot Implementation deployed to:", await botImplementation.getAddress());

    // Add delay between deployments
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 6. Deploy Factory
    console.log("Deploying Factory...");
    const InchbyinchFactory = await ethers.getContractFactory("inchbyinchFactory");
    factory = await InchbyinchFactory.deploy(
      await botImplementation.getAddress(),
      await orderManager.getAddress(),
      await oracleAdapter.getAddress(),
      await mockLOP.getAddress(),
      await lopAdapter.getAddress()
    );
    await factory.waitForDeployment();
    console.log("✅ Factory deployed to:", await factory.getAddress());
  }

  // Setup contracts
  console.log("\n🔐 Setting up contract permissions...");
  
  await orderManager.authorizeBot(await factory.getAddress());
  console.log("✅ Factory authorized in OrderManager");

  // Add delay to avoid nonce issues
  await new Promise(resolve => setTimeout(resolve, 5000));

  await oracleAdapter.authorizeUpdater(await factory.getAddress());
  console.log("✅ Factory authorized in OracleAdapter");

  // Add delay to avoid nonce issues
  await new Promise(resolve => setTimeout(resolve, 5000));

  await lopAdapter.authorizeUpdater(await factory.getAddress());
  console.log("✅ Factory authorized in LOPAdapter");

  // Add delay before bot deployment
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test deployment
  console.log("\n🧪 Testing bot deployment...");
  
  const deploymentCost = ethers.parseEther("0.001"); // Reduced to match new MIN_DEPOSIT
  const tx = await factory.deployBot(deployer.address, { value: deploymentCost });
  const receipt = await tx.wait();
  
  const event = receipt.logs.find(log => log.fragment && log.fragment.name === "BotDeployed");
  const botAddress = event.args.bot;
  console.log("✅ Test bot deployed to:", botAddress);

  // Add longer delay before bot authorization to avoid replacement transaction issues
  console.log("⏳ Waiting 10 seconds before bot authorization...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Test strategy creation
  console.log("\n📊 Testing strategy creation...");
  
  const bot = await ethers.getContractAt("inchbyinchBot", botAddress);
  
  // Authorize the bot
  await orderManager.authorizeBot(botAddress);
  await lopAdapter.authorizeUpdater(botAddress);

  // Add delay before price update
  console.log("⏳ Waiting 5 seconds before price update...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Add price data to OracleAdapter (required for strategy creation)
  console.log("📊 Adding price data to OracleAdapter...");
  const currentPrice = ethers.parseEther("3000"); // $3000 per WETH
  const currentTimestamp = Math.floor(Date.now() / 1000);
  await oracleAdapter.updatePrice(WETH_ADDRESS, currentPrice, currentTimestamp);
  console.log("✅ Price data added to OracleAdapter");

  // Add delay before token approval
  console.log("⏳ Waiting 5 seconds before token approval...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Approve tokens for the bot (required for strategy creation)
  console.log("🔐 Approving tokens for bot...");
  const weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);
  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  
  // Approve WETH and USDC for the bot
  await weth.approve(botAddress, ethers.parseEther("1000")); // Approve 1000 WETH
  await usdc.approve(botAddress, ethers.parseUnits("1000000", 6)); // Approve 1M USDC
  console.log("✅ Tokens approved for bot");

  // Create a test strategy
  await bot.createStrategy(
    WETH_ADDRESS, // WETH
    USDC_ADDRESS, // USDC
    ethers.parseEther("3000"), // startPrice: $3000
    50, // spacing: 50%
    ethers.parseEther("0.001"), // orderSize: 0.001 WETH (smaller for testnet)
    3, // numOrders
    0, // strategyType: BUY_LADDER
    1, // repostMode: REPOST_SAME
    ethers.parseUnits("10", 6), // budget: 10 USDC (smaller for testnet)
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
    network: "baseSepolia",
    chainId: CHAIN_ID,
    deployer: deployer.address,
    contracts: {
      mockLOP: await mockLOP.getAddress(),
      oracleAdapter: await oracleAdapter.getAddress(),
      orderManager: await orderManager.getAddress(),
      lopAdapter: await lopAdapter.getAddress(),
      botImplementation: await botImplementation.getAddress(),
      factory: await factory.getAddress(),
      testBot: botAddress
    },
    external: {
      weth: WETH_ADDRESS,
      usdc: USDC_ADDRESS
    },
    timestamp: new Date().toISOString()
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require('fs');
  fs.writeFileSync('deployment-base-sepolia.json', JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to deployment-base-sepolia.json");

  console.log("\n🎉 Base Sepolia deployment completed successfully!");
  console.log("🔗 Factory Address:", await factory.getAddress());
  console.log("🔗 Test Bot Address:", botAddress);
  console.log("\n💡 Next steps:");
  console.log("1. Verify contracts on Base Sepolia block explorer");
  console.log("2. Test with real tokens on Base Sepolia");
  console.log("3. Monitor gas usage and performance");
  console.log("4. Deploy frontend to connect to Base Sepolia");
  console.log("5. If successful, migrate to mainnet");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 