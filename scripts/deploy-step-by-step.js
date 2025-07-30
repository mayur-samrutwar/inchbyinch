const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts step by step with the account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
    
    // Network configuration
    const network = await ethers.provider.getNetwork();
    console.log("Network chain ID:", network.chainId);
    
    // Contract addresses (these would be different on each network)
    const LOP_ADDRESS = {
        1: "0x3ef51736315f52d568d6d2cf289419b9cfffe782", // Mainnet
        11155111: "0x3ef51736315f52d568d6d2cf289419b9cfffe782", // Sepolia
        84532: "0x3ef51736315f52d568d6d2cf289419b9cfffe782", // Base Sepolia
        80002: "0x3ef51736315f52d568d6d2cf289419b9cfffe782", // Polygon Amoy
    }[network.chainId] || "0x3ef51736315f52d568d6d2cf289419b9cfffe782";
    
    console.log("Using LOP address:", LOP_ADDRESS);
    
    let orderManagerAddress, oracleAdapterAddress, botImplementationAddress, factoryAddress;
    
    try {
        // Step 1: Deploy OrderManager
        console.log("\n1. Deploying OrderManager...");
        const OrderManager = await ethers.getContractFactory("OrderManager");
        const orderManager = await OrderManager.deploy();
        await orderManager.waitForDeployment();
        orderManagerAddress = await orderManager.getAddress();
        console.log("✅ OrderManager deployed to:", orderManagerAddress);
        
        // Step 2: Deploy OracleAdapter
        console.log("\n2. Deploying OracleAdapter...");
        const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
        const oracleAdapter = await OracleAdapter.deploy();
        await oracleAdapter.waitForDeployment();
        oracleAdapterAddress = await oracleAdapter.getAddress();
        console.log("✅ OracleAdapter deployed to:", oracleAdapterAddress);
        
        // Step 3: Deploy Bot Implementation
        console.log("\n3. Deploying Bot Implementation...");
        const InchByInchBot = await ethers.getContractFactory("inchbyinchBot");
        const botImplementation = await InchByInchBot.deploy();
        await botImplementation.waitForDeployment();
        botImplementationAddress = await botImplementation.getAddress();
        console.log("✅ Bot Implementation deployed to:", botImplementationAddress);
        
        // Step 4: Deploy Factory
        console.log("\n4. Deploying Factory...");
        const InchByInchFactory = await ethers.getContractFactory("inchbyinchFactory");
        const factory = await InchByInchFactory.deploy(
            botImplementationAddress,
            orderManagerAddress,
            oracleAdapterAddress,
            LOP_ADDRESS
        );
        await factory.waitForDeployment();
        factoryAddress = await factory.getAddress();
        console.log("✅ Factory deployed to:", factoryAddress);
        
        // Step 5: Configure OracleAdapter
        console.log("\n5. Configuring OracleAdapter...");
        
        // Set volatility config for ETH (example)
        const ethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH
        const volatilityConfig = {
            baseSpacing: ethers.parseEther("50"), // $50 base spacing
            volatilityMultiplier: 100, // 100% multiplier
            minSpacing: ethers.parseEther("10"), // $10 min spacing
            maxSpacing: ethers.parseEther("200") // $200 max spacing
        };
        
        await oracleAdapter.setVolatilityConfig(ethAddress, volatilityConfig);
        console.log("✅ Set volatility config for ETH");
        
        // Authorize factory as updater for oracle
        await oracleAdapter.authorizeUpdater(factoryAddress);
        console.log("✅ Authorized factory as oracle updater");
        
        // Authorize factory as bot for order manager
        await orderManager.authorizeBot(factoryAddress);
        console.log("✅ Authorized factory as bot in order manager");
        
        console.log("\n🎉 All contracts deployed and configured successfully!");
        console.log("\nDeployed Addresses:");
        console.log("OrderManager:", orderManagerAddress);
        console.log("OracleAdapter:", oracleAdapterAddress);
        console.log("Bot Implementation:", botImplementationAddress);
        console.log("Factory:", factoryAddress);
        
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 