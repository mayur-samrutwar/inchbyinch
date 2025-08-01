const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Core Contract Tests", function () {
    let orderManager, oracleAdapter, factory, botImplementation;
    let mockLop, lopAdapter;
    let owner, user1, user2;
    
    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        // Deploy core contracts
        const OrderManager = await ethers.getContractFactory("OrderManager");
        orderManager = await OrderManager.deploy();
        await orderManager.waitForDeployment();
        
        const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
        oracleAdapter = await OracleAdapter.deploy();
        await oracleAdapter.waitForDeployment();
        
        const MockLOP = await ethers.getContractFactory("MockLOP");
        mockLop = await MockLOP.deploy();
        await mockLop.waitForDeployment();
        
        const LOPAdapter = await ethers.getContractFactory("LOPAdapter");
        lopAdapter = await LOPAdapter.deploy(await mockLop.getAddress());
        await lopAdapter.waitForDeployment();
        
        const InchByInchBot = await ethers.getContractFactory("inchbyinchBot");
        botImplementation = await InchByInchBot.deploy();
        await botImplementation.waitForDeployment();
        
        const InchByInchFactory = await ethers.getContractFactory("inchbyinchFactory");
        factory = await InchByInchFactory.deploy(
            await botImplementation.getAddress(),
            await orderManager.getAddress(),
            await oracleAdapter.getAddress(),
            await mockLop.getAddress(),
            await lopAdapter.getAddress()
        );
        await factory.waitForDeployment();
        
        // Setup authorizations
        await orderManager.authorizeBot(await factory.getAddress());
        await oracleAdapter.authorizeUpdater(await factory.getAddress());
        await lopAdapter.authorizeUpdater(await factory.getAddress());

        // Transfer ownership to factory for proper authorization
        await orderManager.transferOwnership(await factory.getAddress());
        await oracleAdapter.transferOwnership(await factory.getAddress());
        await lopAdapter.transferOwnership(await factory.getAddress());
    });
    
    describe("Contract Deployment", function () {
        it("Should deploy all contracts successfully", async function () {
            expect(await orderManager.owner()).to.equal(await factory.getAddress());
            expect(await oracleAdapter.owner()).to.equal(await factory.getAddress());
            expect(await factory.owner()).to.equal(owner.address);
        });
        
        it("Should have correct factory configuration", async function () {
            expect(await factory.botImplementation()).to.equal(await botImplementation.getAddress());
            expect(await factory.orderManager()).to.equal(await orderManager.getAddress());
            expect(await factory.oracleAdapter()).to.equal(await oracleAdapter.getAddress());
        });
    });
    
    describe("Authorization", function () {
        it("Should have factory as owner of contracts", async function () {
            expect(await orderManager.owner()).to.equal(await factory.getAddress());
            expect(await oracleAdapter.owner()).to.equal(await factory.getAddress());
            expect(await lopAdapter.owner()).to.equal(await factory.getAddress());
        });
    });
    
    describe("Factory Bot Deployment", function () {
        it("Should deploy a bot through factory", async function () {
            const deploymentCost = ethers.parseEther("0.001"); // Match MIN_DEPOSIT
            
            const tx = await factory.connect(user1).deployBot(user1.address, { value: deploymentCost });
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "BotDeployed"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.user).to.equal(user1.address);
        });
        
        it("Should track deployed bots correctly", async function () {
            const deploymentCost = ethers.parseEther("0.001"); // Match MIN_DEPOSIT
            await factory.connect(user1).deployBot(user1.address, { value: deploymentCost });
            
            const userBots = await factory.getUserBots(user1.address);
            expect(userBots.length).to.equal(1);
        });
    });
}); 