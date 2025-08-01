const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LOP Integration Tests", function () {
    let deployer, user1, user2;
    let oracleAdapter, orderManager, lopAdapter, factory, botImplementation;
    let testBot;
    let mockLOP, mockUSDC, mockETH;

    beforeEach(async function () {
        [deployer, user1, user2] = await ethers.getSigners();

        // Deploy mock contracts
        const MockLOP = await ethers.getContractFactory("MockLOP");
        mockLOP = await MockLOP.deploy();
        await mockLOP.waitForDeployment();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("USD Coin", "USDC");
        await mockUSDC.waitForDeployment();
        
        mockETH = await MockERC20.deploy("Ethereum", "ETH");
        await mockETH.waitForDeployment();

        // Deploy core contracts
        const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
        oracleAdapter = await OracleAdapter.deploy();
        await oracleAdapter.waitForDeployment();

        const OrderManager = await ethers.getContractFactory("OrderManager");
        orderManager = await OrderManager.deploy();
        await orderManager.waitForDeployment();

        const LOPAdapter = await ethers.getContractFactory("LOPAdapter");
        lopAdapter = await LOPAdapter.deploy(await mockLOP.getAddress());
        await lopAdapter.waitForDeployment();

        const InchbyinchBot = await ethers.getContractFactory("inchbyinchBot");
        botImplementation = await InchbyinchBot.deploy();
        await botImplementation.waitForDeployment();

        const InchbyinchFactory = await ethers.getContractFactory("inchbyinchFactory");
        factory = await InchbyinchFactory.deploy(
            await botImplementation.getAddress(),
            await orderManager.getAddress(),
            await oracleAdapter.getAddress(),
            await mockLOP.getAddress(),
            await lopAdapter.getAddress()
        );
        await factory.waitForDeployment();

        // Setup contracts
        await orderManager.authorizeBot(await factory.getAddress());
        await lopAdapter.authorizeUpdater(await factory.getAddress());

        // Deploy test bot
        await factory.deployBot();
        const userBots = await factory.getUserBots(deployer.address);
        const botAddress = userBots[userBots.length - 1];
        testBot = await ethers.getContractAt("inchbyinchBot", botAddress);

        // Initialize bot
        await testBot.initialize(
            await mockLOP.getAddress(),
            await lopAdapter.getAddress(),
            await orderManager.getAddress(),
            await oracleAdapter.getAddress(),
            deployer.address
        );

        // Setup mock prices
        await oracleAdapter.updatePrice(
            await mockETH.getAddress(),
            ethers.parseEther("3000"),
            Math.floor(Date.now() / 1000),
            500
        );

        // Fund bot with tokens
        await mockUSDC.mint(await testBot.getAddress(), ethers.parseEther("10000"));
        await mockETH.mint(await testBot.getAddress(), ethers.parseEther("10"));
    });

    describe("LOPAdapter", function () {
        it("should create orders correctly", async function () {
            const orderHash = await lopAdapter.createOrder(
                await mockETH.getAddress(),
                await mockUSDC.getAddress(),
                ethers.parseEther("1"),
                ethers.parseEther("3000"),
                deployer.address,
                ethers.ZeroAddress,
                "0x"
            );

            expect(orderHash).to.not.equal(ethers.ZeroHash);

            const [exists, timestamp] = await lopAdapter.getOrderInfo(orderHash);
            expect(exists).to.be.true;
            expect(timestamp).to.be.greaterThan(0);
        });

        it("should cancel orders correctly", async function () {
            const orderHash = await lopAdapter.createOrder(
                await mockETH.getAddress(),
                await mockUSDC.getAddress(),
                ethers.parseEther("1"),
                ethers.parseEther("3000"),
                deployer.address,
                ethers.ZeroAddress,
                "0x"
            );

            await lopAdapter.cancelOrder(orderHash);
            
            const [exists, timestamp] = await lopAdapter.getOrderInfo(orderHash);
            expect(exists).to.be.false;
        });

        it("should handle order fills correctly", async function () {
            const orderHash = await lopAdapter.createOrder(
                await mockETH.getAddress(),
                await mockUSDC.getAddress(),
                ethers.parseEther("1"),
                ethers.parseEther("3000"),
                deployer.address,
                ethers.ZeroAddress,
                "0x"
            );

            // Simulate order fill
            await mockLOP.simulateFill(orderHash);
            
            const [exists, timestamp] = await lopAdapter.getOrderInfo(orderHash);
            expect(exists).to.be.false; // Order should be removed after fill
        });
    });

    describe("Bot LOP Integration", function () {
        it("should place buy ladder orders", async function () {
            const strategy = {
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockETH.getAddress(),
                startPrice: ethers.parseEther("3000"),
                endPrice: ethers.parseEther("2800"),
                orderSize: ethers.parseEther("1000"),
                numOrders: 5,
                isBuyLadder: true
            };

            await testBot.createBuyLadder(strategy);

            const orders = await testBot.getActiveOrders();
            expect(orders.length).to.equal(5);
        });

        it("should place sell ladder orders", async function () {
            const strategy = {
                tokenIn: await mockETH.getAddress(),
                tokenOut: await mockUSDC.getAddress(),
                startPrice: ethers.parseEther("3000"),
                endPrice: ethers.parseEther("3200"),
                orderSize: ethers.parseEther("1"),
                numOrders: 5,
                isBuyLadder: false
            };

            await testBot.createSellLadder(strategy);

            const orders = await testBot.getActiveOrders();
            expect(orders.length).to.equal(5);
        });

        it("should handle order reposting after fills", async function () {
            const strategy = {
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockETH.getAddress(),
                startPrice: ethers.parseEther("3000"),
                endPrice: ethers.parseEther("2800"),
                orderSize: ethers.parseEther("1000"),
                numOrders: 3,
                isBuyLadder: true,
                repostOnFill: true
            };

            await testBot.createBuyLadder(strategy);
            
            const initialOrders = await testBot.getActiveOrders();
            expect(initialOrders.length).to.equal(3);

            // Simulate fill of first order
            const firstOrderHash = initialOrders[0];
            await mockLOP.simulateFill(firstOrderHash);
            
            // Trigger reposting
            await testBot.handleOrderFill(firstOrderHash);
            
            const updatedOrders = await testBot.getActiveOrders();
            expect(updatedOrders.length).to.equal(3); // Should still have 3 orders
        });
    });
}); 