const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying inchbyinch with LOP integration...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // LOP contract addresses (mainnet only)
  const LOP_ADDRESSES = {
    ethereum: "0x111111125421ca6dc452d289314280a0f8842a65",
    base: "0x111111125421ca6dc452d289314280a0f8842a65",
    polygon: "0x111111125421ca6dc452d289314280a0f8842a65",
    arbitrum: "0x111111125421ca6dc452d289314280a0f8842a65",
    optimism: "0x111111125421ca6dc452d289314280a0f8842a65",
    bsc: "0x111111125421ca6dc452d289314280a0f8842a65",
  };

  // Get network
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  
  console.log("Network chainId:", chainId);
  
  // Determine LOP address based on network
  let lopAddress;
  let useMockLOP = false;
  
  if (chainId === 1) lopAddress = LOP_ADDRESSES.ethereum;
  else if (chainId === 8453) lopAddress = LOP_ADDRESSES.base;
  else if (chainId === 137) lopAddress = LOP_ADDRESSES.polygon;
  else if (chainId === 42161) lopAddress = LOP_ADDRESSES.arbitrum;
  else if (chainId === 10) lopAddress = LOP_ADDRESSES.optimism;
  else if (chainId === 56) lopAddress = LOP_ADDRESSES.bsc;
  else {
    // Testnet - use mock LOP
    console.log("⚠️  Testnet detected, deploying MockLOP");
    useMockLOP = true;
    lopAddress = "MOCK"; // Will be replaced with deployed mock
  }

  console.log("Using LOP address:", lopAddress);

  // Deploy contracts
  console.log("\n📦 Deploying contracts...");

  // 0. Deploy MockLOP if on testnet
  let mockLOP;
  if (useMockLOP) {
    console.log("Deploying MockLOP for testnet...");
    const MockLOP = await ethers.getContractFactory("MockLOP");
    mockLOP = await MockLOP.deploy();
    await mockLOP.waitForDeployment();
    lopAddress = await mockLOP.getAddress();
    console.log("✅ MockLOP deployed to:", lopAddress);
  }

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
  const lopAdapter = await LOPAdapter.deploy(lopAddress);
  await lopAdapter.waitForDeployment();
  console.log("✅ LOPAdapter deployed to:", await lopAdapter.getAddress());

  // 4. Deploy inchbyinchBot implementation
  console.log("Deploying inchbyinchBot implementation...");
  const InchbyinchBot = await ethers.getContractFactory("inchbyinchBot");
  const botImplementation = await InchbyinchBot.deploy();
  await botImplementation.waitForDeployment();
  console.log("✅ Bot implementation deployed to:", await botImplementation.getAddress());

  // 5. Deploy inchbyinchFactory
  console.log("Deploying inchbyinchFactory...");
  const InchbyinchFactory = await ethers.getContractFactory("inchbyinchFactory");
  const factory = await InchbyinchFactory.deploy(
    await botImplementation.getAddress(),
    await orderManager.getAddress(),
    await oracleAdapter.getAddress(),
    lopAddress
  );
  await factory.waitForDeployment();
  console.log("✅ Factory deployed to:", await factory.getAddress());

  // Setup contracts
  console.log("\n🔧 Setting up contracts...");

  // Authorize factory in order manager
  console.log("Authorizing factory in OrderManager...");
  const authTx = await orderManager.authorizeBot(await factory.getAddress());
  await authTx.wait();
  console.log("✅ Factory authorized in OrderManager");

  // Authorize factory in LOP adapter
  console.log("Authorizing factory in LOPAdapter...");
  const lopAuthTx = await lopAdapter.authorizeUpdater(await factory.getAddress());
  await lopAuthTx.wait();
  console.log("✅ Factory authorized in LOPAdapter");

  // Setup price feeds in oracle adapter
  console.log("Setting up price feeds...");
  
  // Common token addresses (you may need to adjust these)
  const TOKENS = {
    ETH: "0x0000000000000000000000000000000000000000", // Native ETH
    USDC: "0xA0b86a33E6441E6C8C8C8C8C8C8C8C8C8C8C8C8", // Placeholder
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
  };

  // Add some mock price data for testing
  console.log("Adding mock price data...");
  for (const [symbol, address] of Object.entries(TOKENS)) {
    if (address !== "0x0000000000000000000000000000000000000000") {
      try {
        const mockPrice = symbol === "ETH" ? ethers.parseEther("3000") : 
                         symbol === "USDC" ? ethers.parseEther("1") :
                         symbol === "USDT" ? ethers.parseEther("1") :
                         symbol === "WBTC" ? ethers.parseEther("45000") :
                         ethers.parseEther("1"); // DAI
        
        const updateTx = await oracleAdapter.updatePrice(
          address,
          mockPrice,
          Math.floor(Date.now() / 1000),
          500 // 5% volatility
        );
        await updateTx.wait();
        console.log(`✅ Added mock price for ${symbol}`);
      } catch (error) {
        console.log(`⚠️  Could not add price for ${symbol}:`, error.message);
      }
    }
  }

  // Deploy a test bot
  console.log("\n🤖 Deploying test bot...");
  const deployBotTx = await factory.deployBot();
  await deployBotTx.wait();
  
  const userBots = await factory.getUserBots(deployer.address);
  const botAddress = userBots[userBots.length - 1];
  console.log("✅ Test bot deployed to:", botAddress);

  // Initialize the bot
  console.log("Initializing test bot...");
  const bot = await ethers.getContractAt("inchbyinchBot", botAddress);
  const initTx = await bot.initialize(
    lopAddress,
    await lopAdapter.getAddress(),
    await orderManager.getAddress(),
    await oracleAdapter.getAddress(),
    deployer.address
  );
  await initTx.wait();
  console.log("✅ Bot initialized");

  // Print deployment summary
  console.log("\n🎉 Deployment Complete!");
  console.log("=".repeat(50));
  console.log("📋 Contract Addresses:");
  console.log("OracleAdapter:", await oracleAdapter.getAddress());
  console.log("OrderManager:", await orderManager.getAddress());
  console.log("LOPAdapter:", await lopAdapter.getAddress());
  console.log("Bot Implementation:", await botImplementation.getAddress());
  console.log("Factory:", await factory.getAddress());
  console.log("Test Bot:", botAddress);
  console.log("LOP Contract:", lopAddress);
  console.log("=".repeat(50));

  // Save deployment info
  const deploymentInfo = {
    network: {
      chainId: chainId,
      name: network.name
    },
    contracts: {
      oracleAdapter: await oracleAdapter.getAddress(),
      orderManager: await orderManager.getAddress(),
      lopAdapter: await lopAdapter.getAddress(),
      botImplementation: await botImplementation.getAddress(),
      factory: await factory.getAddress(),
      testBot: botAddress,
      lop: lopAddress
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  console.log("\n💾 Deployment info saved to deployment-info.json");
  require('fs').writeFileSync(
    'deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n🚀 Ready to test LOP integration!");
  console.log("Next steps:");
  console.log("1. Fund the test bot with tokens");
  console.log("2. Create a strategy");
  console.log("3. Place ladder orders");
  console.log("4. Test order fills and reposting");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 