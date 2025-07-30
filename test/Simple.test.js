const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Simple Contract Tests", function () {
    let orderManager;
    let oracleAdapter;
    let factory;
    let botImplementation;
    let owner;
    let user1;
    
    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();
        
        // Deploy OrderManager
        const OrderManager = await ethers.getContractFactory("OrderManager");
        orderManager = await OrderManager.deploy();
        await orderManager.waitForDeployment();
        
        // Deploy OracleAdapter
        const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
        oracleAdapter = await OracleAdapter.deploy();
        await oracleAdapter.waitForDeployment();
        
        // Deploy Bot Implementation
        const InchByInchBot = await ethers.getContractFactory("inchbyinchBot");
        botImplementation = await InchByInchBot.deploy();
        await botImplementation.waitForDeployment();
        
        // Deploy Factory
        const InchByInchFactory = await ethers.getContractFactory("inchbyinchFactory");
        factory = await InchByInchFactory.deploy(
            await botImplementation.getAddress(),
            await orderManager.getAddress(),
            await oracleAdapter.getAddress(),
            "0x3ef51736315f52d568d6d2cf289419b9cfffe782" // LOP address
        );
        await factory.waitForDeployment();
        
        // Authorize factory in OrderManager and OracleAdapter
        await orderManager.authorizeBot(await factory.getAddress());
        await oracleAdapter.authorizeUpdater(await factory.getAddress());
    });
    
    describe("Basic Functionality", function () {
        it("Should deploy all contracts successfully", async function () {
            expect(await orderManager.owner()).to.equal(owner.address);
            expect(await oracleAdapter.owner()).to.equal(owner.address);
            expect(await factory.owner()).to.equal(owner.address);
        });
        
        it("Should authorize bots in OrderManager", async function () {
            await orderManager.authorizeBot(user1.address);
            expect(await orderManager.isBotAuthorized(user1.address)).to.be.true;
        });
        
        it("Should authorize updaters in OracleAdapter", async function () {
            await oracleAdapter.authorizeUpdater(user1.address);
            expect(await oracleAdapter.isUpdaterAuthorized(user1.address)).to.be.true;
        });
        
        it("Should deploy a bot through factory", async function () {
            const deploymentCost = ethers.parseEther("0.01");
            
            const tx = await factory.connect(user1).deployBot(user1.address, { value: deploymentCost });
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "BotDeployed"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.user).to.equal(user1.address);
        });
    });
}); 