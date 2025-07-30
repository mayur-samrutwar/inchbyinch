const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying OrderManager with the account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
    
    // Network configuration
    const network = await ethers.provider.getNetwork();
    console.log("Network chain ID:", network.chainId);
    
    try {
        // Deploy OrderManager only
        console.log("\nDeploying OrderManager...");
        const OrderManager = await ethers.getContractFactory("OrderManager");
        const orderManager = await OrderManager.deploy();
        await orderManager.waitForDeployment();
        const orderManagerAddress = await orderManager.getAddress();
        console.log("OrderManager deployed to:", orderManagerAddress);
        
        console.log("✅ Deployment successful!");
        
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