const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying inchbyinch contracts with proper authorization...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Deploy core contracts
    console.log("📦 Deploying core contracts...");
    
    const OrderManager = await ethers.getContractFactory("OrderManager");
    const orderManager = await OrderManager.deploy();
    await orderManager.waitForDeployment();
    console.log("✅ OrderManager deployed to:", await orderManager.getAddress());

    const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    const oracleAdapter = await OracleAdapter.deploy();
    await oracleAdapter.waitForDeployment();
    console.log("✅ OracleAdapter deployed to:", await oracleAdapter.getAddress());

    const MockLOP = await ethers.getContractFactory("MockLOP");
    const mockLOP = await MockLOP.deploy();
    await mockLOP.waitForDeployment();
    console.log("✅ MockLOP deployed to:", await mockLOP.getAddress());

    const LOPAdapter = await ethers.getContractFactory("LOPAdapter");
    const lopAdapter = await LOPAdapter.deploy(await mockLOP.getAddress());
    await lopAdapter.waitForDeployment();
    console.log("✅ LOPAdapter deployed to:", await lopAdapter.getAddress());

    const InchbyinchBot = await ethers.getContractFactory("inchbyinchBot");
    const botImplementation = await InchbyinchBot.deploy();
    await botImplementation.waitForDeployment();
    console.log("✅ Bot implementation deployed to:", await botImplementation.getAddress());

    const InchbyinchFactory = await ethers.getContractFactory("inchbyinchFactory");
    const factory = await InchbyinchFactory.deploy(
        await botImplementation.getAddress(),
        await orderManager.getAddress(),
        await oracleAdapter.getAddress(),
        await mockLOP.getAddress(),
        await lopAdapter.getAddress()
    );
    await factory.waitForDeployment();
    console.log("✅ Factory deployed to:", await factory.getAddress());

    // Setup authorizations
    console.log("🔐 Setting up authorizations...");
    
    // Transfer ownership of OrderManager to factory
    await orderManager.transferOwnership(await factory.getAddress());
    console.log("✅ OrderManager ownership transferred to factory");

    // Transfer ownership of OracleAdapter to factory
    await oracleAdapter.transferOwnership(await factory.getAddress());
    console.log("✅ OracleAdapter ownership transferred to factory");

    // Transfer ownership of LOPAdapter to factory
    await lopAdapter.transferOwnership(await factory.getAddress());
    console.log("✅ LOPAdapter ownership transferred to factory");

    // Now factory can authorize itself since it's the owner
    console.log("✅ All ownership transfers complete");

    console.log("\n🎉 Deployment complete!");
    console.log("📋 Contract addresses:");
    console.log("OrderManager:", await orderManager.getAddress());
    console.log("OracleAdapter:", await oracleAdapter.getAddress());
    console.log("MockLOP:", await mockLOP.getAddress());
    console.log("LOPAdapter:", await lopAdapter.getAddress());
    console.log("Bot Implementation:", await botImplementation.getAddress());
    console.log("Factory:", await factory.getAddress());

    // Test deployment
    console.log("\n🧪 Testing bot deployment...");
    const deploymentCost = ethers.parseEther("0.001");
    const tx = await factory.deployBot(deployer.address, { value: deploymentCost });
    const receipt = await tx.wait();
    console.log("✅ Bot deployment successful!");

    const userBots = await factory.getUserBots(deployer.address);
    console.log("📊 User bots:", userBots.length);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 