const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Using existing deployed contracts on Base Sepolia...");

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient balance for deployment. Need at least 0.01 ETH");
  }

  // Use the most recently deployed factory address from your transaction history
  // Replace this with your actual factory address from the latest deployment
  const FACTORY_ADDRESS = "0xEB100be17c1d4Ea03E8AA8a017A5063955172c5D"; // From your latest deployment
  
  console.log("📋 Using existing factory:", FACTORY_ADDRESS);

  // Get the factory contract
  const factory = await ethers.getContractAt("inchbyinchFactory", FACTORY_ADDRESS);
  
  // Get the other contract addresses from the factory
  const orderManagerAddress = await factory.orderManager();
  const oracleAdapterAddress = await factory.oracleAdapter();
  const lopAdapterAddress = await factory.lopAdapter();
  
  console.log("📋 Existing contract addresses:");
  console.log("- Factory:", FACTORY_ADDRESS);
  console.log("- OrderManager:", orderManagerAddress);
  console.log("- OracleAdapter:", oracleAdapterAddress);
  console.log("- LOPAdapter:", lopAdapterAddress);

  // Get contract instances
  const orderManager = await ethers.getContractAt("OrderManager", orderManagerAddress);
  const oracleAdapter = await ethers.getContractAt("OracleAdapter", oracleAdapterAddress);
  const lopAdapter = await ethers.getContractAt("LOPAdapter", lopAdapterAddress);

  // Test bot deployment (much cheaper than re-deploying all contracts)
  console.log("\n🧪 Testing bot deployment with existing contracts...");
  
  const deploymentCost = ethers.parseEther("0.001"); // Reduced deposit
  const tx = await factory.deployBot(deployer.address, { value: deploymentCost });
  const receipt = await tx.wait();
  
  const event = receipt.logs.find(log => log.fragment && log.fragment.name === "BotDeployed");
  const botAddress = event.args.bot;
  console.log("✅ Test bot deployed to:", botAddress);

  // Add delay before bot authorization
  console.log("⏳ Waiting 10 seconds before bot authorization...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Test strategy creation
  console.log("\n📊 Testing strategy creation...");
  
  const bot = await ethers.getContractAt("inchbyinchBot", botAddress);
  
  // Authorize the bot
  await orderManager.authorizeBot(botAddress);
  await lopAdapter.authorizeUpdater(botAddress, { gasPrice: 3000000000 }); // 3 gwei for this transaction

  // Also authorize the bot in OrderManager (this might be missing)
  console.log("🔐 Authorizing bot in OrderManager...");
  await orderManager.authorizeBot(botAddress, { gasPrice: 3000000000 });
  console.log("✅ Bot authorized in OrderManager");

  // Add delay before price update
  console.log("⏳ Waiting 5 seconds before price update...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Add price data to OracleAdapter
  console.log("📊 Adding price data to OracleAdapter...");
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
  const currentPrice = ethers.parseEther("3000"); // $3000 per WETH
  const currentTimestamp = Math.floor(Date.now() / 1000);
  await oracleAdapter.updatePrice(WETH_ADDRESS, currentPrice, currentTimestamp, { gasPrice: 3000000000 });
  console.log("✅ Price data added to OracleAdapter");

  // Add delay before token approval
  console.log("⏳ Waiting 5 seconds before token approval...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Approve tokens for the bot
  console.log("🔐 Approving tokens for bot...");
  const weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);
  const USDC_ADDRESS = "0x036cbd53842c5426634e7929541ec2318f3dcf7e"; // Real Base Sepolia USDC
  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  
  await weth.approve(botAddress, ethers.parseEther("1000"), { gasPrice: 3000000000 });
  await usdc.approve(botAddress, ethers.parseUnits("1000000", 6), { gasPrice: 3000000000 });
  console.log("✅ Tokens approved for bot");

  // Add delay before strategy creation
  console.log("⏳ Waiting 5 seconds before strategy creation...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Create a test strategy
  console.log("📊 Creating test strategy...");
  await bot.createStrategy(
    WETH_ADDRESS, // WETH
    USDC_ADDRESS, // USDC
    ethers.parseEther("3000"), // startPrice: $3000
    50, // spacing: 50%
    ethers.parseEther("0.001"), // orderSize: 0.001 WETH
    3, // numOrders
    0, // strategyType: BUY_LADDER
    1, // repostMode: REPOST_SAME
    ethers.parseUnits("10", 6), // budget: 10 USDC
    0, // stopLoss: 0 (disabled)
    0, // takeProfit: 0 (disabled)
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

  console.log("\n🎉 Successfully used existing contracts!");
  console.log("🔗 Factory Address:", FACTORY_ADDRESS);
  console.log("🔗 Test Bot Address:", botAddress);
  console.log("💰 Total cost: Only bot deployment (0.001 ETH) + gas");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 