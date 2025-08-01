const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts with the account:", deployer.address);
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
    
    try {
        // Deploy OrderManager
        console.log("\n1. Deploying OrderManager...");
        const OrderManager = await ethers.getContractFactory("OrderManager");
        const orderManager = await OrderManager.deploy();
        await orderManager.waitForDeployment();
        const orderManagerAddress = await orderManager.getAddress();
        console.log("OrderManager deployed to:", orderManagerAddress);
        
        // Deploy OracleAdapter
        console.log("\n2. Deploying OracleAdapter...");
        const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
        const oracleAdapter = await OracleAdapter.deploy();
        await oracleAdapter.waitForDeployment();
        const oracleAdapterAddress = await oracleAdapter.getAddress();
        console.log("OracleAdapter deployed to:", oracleAdapterAddress);
        
        // Deploy LOPAdapter
        console.log("\n3. Deploying LOPAdapter...");
        const LOPAdapter = await ethers.getContractFactory("LOPAdapter");
        const lopAdapter = await LOPAdapter.deploy(LOP_ADDRESS);
        await lopAdapter.waitForDeployment();
        const lopAdapterAddress = await lopAdapter.getAddress();
        console.log("LOPAdapter deployed to:", lopAdapterAddress);
        
        // Deploy Bot Implementation
        console.log("\n4. Deploying Bot Implementation...");
        const InchByInchBot = await ethers.getContractFactory("inchbyinchBot");
        const botImplementation = await InchByInchBot.deploy();
        await botImplementation.waitForDeployment();
        const botImplementationAddress = await botImplementation.getAddress();
        console.log("Bot Implementation deployed to:", botImplementationAddress);
        
        // Deploy Factory
        console.log("\n5. Deploying Factory...");
        const InchByInchFactory = await ethers.getContractFactory("inchbyinchFactory");
        const factory = await InchByInchFactory.deploy(
            botImplementationAddress,
            orderManagerAddress,
            oracleAdapterAddress,
            LOP_ADDRESS,
            lopAdapterAddress
        );
        await factory.waitForDeployment();
        const factoryAddress = await factory.getAddress();
        console.log("Factory deployed to:", factoryAddress);
        
        // Initialize OracleAdapter with some default configurations
        console.log("\n6. Configuring OracleAdapter...");
        
        // Set volatility config for ETH (example)
        const ethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH
        const volatilityConfig = {
            baseSpacing: ethers.parseEther("50"), // $50 base spacing
            volatilityMultiplier: 100, // 100% multiplier
            minSpacing: ethers.parseEther("10"), // $10 min spacing
            maxSpacing: ethers.parseEther("200") // $200 max spacing
        };
        
        await oracleAdapter.setVolatilityConfig(ethAddress, volatilityConfig);
        console.log("Set volatility config for ETH");
        
        // Setup authorizations
        console.log("\n7. Setting up authorizations...");
        
        // Transfer ownership of OrderManager to factory
        await orderManager.transferOwnership(factoryAddress);
        console.log("✅ OrderManager ownership transferred to factory");

        // Transfer ownership of OracleAdapter to factory
        await oracleAdapter.transferOwnership(factoryAddress);
        console.log("✅ OracleAdapter ownership transferred to factory");

        // Transfer ownership of LOPAdapter to factory
        await lopAdapter.transferOwnership(factoryAddress);
        console.log("✅ LOPAdapter ownership transferred to factory");
        
        // Deploy a test bot instance
        console.log("\n8. Deploying test bot instance...");
        const deploymentCost = ethers.parseEther("0.001");
        const tx = await factory.deployBot(deployer.address, { value: deploymentCost });
        const receipt = await tx.wait();
        
        const botDeployedEvent = receipt.logs.find(log => 
            log.fragment && log.fragment.name === "BotDeployed"
        );
        
        if (botDeployedEvent) {
            const botAddress = botDeployedEvent.args.bot;
            console.log("Test bot deployed to:", botAddress);
        }
        
        // Print deployment summary
        console.log("\n" + "=".repeat(50));
        console.log("DEPLOYMENT SUMMARY");
        console.log("=".repeat(50));
        console.log("Network:", network.name || "Unknown");
        console.log("Chain ID:", network.chainId);
        console.log("Deployer:", deployer.address);
        console.log("");
        console.log("Contract Addresses:");
        console.log("- OrderManager:", orderManagerAddress);
        console.log("- OracleAdapter:", oracleAdapterAddress);
        console.log("- LOPAdapter:", lopAdapterAddress);
        console.log("- Bot Implementation:", botImplementationAddress);
        console.log("- Factory:", factoryAddress);
        console.log("- LOP:", LOP_ADDRESS);
        console.log("");
        console.log("Configuration:");
        console.log("- Factory is owner of all contracts");
        console.log("- ETH volatility config set");
        console.log("- Test bot deployed");
        console.log("=".repeat(50));
        
        // Save deployment info
        const deploymentInfo = {
            network: network.name || "Unknown",
            chainId: network.chainId.toString(),
            deployer: deployer.address,
            contracts: {
                orderManager: orderManagerAddress,
                oracleAdapter: oracleAdapterAddress,
                lopAdapter: lopAdapterAddress,
                botImplementation: botImplementationAddress,
                factory: factoryAddress,
                lop: LOP_ADDRESS
            },
            timestamp: new Date().toISOString()
        };
        
        // Write to file
        const fs = require("fs");
        const path = require("path");
        const deploymentPath = path.join(__dirname, "..", "deployments", `${network.chainId}.json`);
        
        // Ensure deployments directory exists
        const deploymentsDir = path.dirname(deploymentPath);
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`\nDeployment info saved to: ${deploymentPath}`);
        
        // Verify contracts on Etherscan (if not on local network)
        if (network.chainId !== 31337) {
            console.log("\n9. Verifying contracts on Etherscan...");
            
            try {
                await verifyContract(orderManagerAddress, []);
                console.log("OrderManager verified");
            } catch (error) {
                console.log("OrderManager verification failed:", error.message);
            }
            
            try {
                await verifyContract(oracleAdapterAddress, []);
                console.log("OracleAdapter verified");
            } catch (error) {
                console.log("OracleAdapter verification failed:", error.message);
            }
            
            try {
                await verifyContract(lopAdapterAddress, [LOP_ADDRESS]);
                console.log("LOPAdapter verified");
            } catch (error) {
                console.log("LOPAdapter verification failed:", error.message);
            }
            
            try {
                await verifyContract(botImplementationAddress, []);
                console.log("Bot Implementation verified");
            } catch (error) {
                console.log("Bot Implementation verification failed:", error.message);
            }
            
            try {
                await verifyContract(factoryAddress, [
                    botImplementationAddress,
                    orderManagerAddress,
                    oracleAdapterAddress,
                    LOP_ADDRESS,
                    lopAdapterAddress
                ]);
                console.log("Factory verified");
            } catch (error) {
                console.log("Factory verification failed:", error.message);
            }
        }
        
        console.log("\n✅ Deployment completed successfully!");
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

async function verifyContract(address, constructorArguments) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: constructorArguments,
        });
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("Contract already verified");
        } else {
            throw error;
        }
    }
}

// Handle errors
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 