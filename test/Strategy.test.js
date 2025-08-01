const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Strategy Tests", function () {
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

    describe("Buy Ladder Strategy", function () {
        it("should create buy ladder with correct price spacing", async function () {
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

            // Check price spacing
            const orderDetails = await Promise.all(
                orders.map(orderHash => lopAdapter.getOrderInfo(orderHash))
            );

            // Prices should be descending from 3000 to 2800
            const prices = orderDetails.map(([exists, timestamp]) => timestamp);
            expect(prices[0]).to.be.greaterThan(prices[prices.length - 1]);
        });

        it("should handle buy ladder with budget limits", async function () {
            const strategy = {
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockETH.getAddress(),
                startPrice: ethers.parseEther("3000"),
                endPrice: ethers.parseEther("2800"),
                orderSize: ethers.parseEther("1000"),
                numOrders: 10,
                isBuyLadder: true,
                maxBudget: ethers.parseEther("5000") // Should limit to 5 orders
            };

            await testBot.createBuyLadder(strategy);

            const orders = await testBot.getActiveOrders();
            expect(orders.length).to.equal(5); // Limited by budget
        });
    });

    describe("Sell Ladder Strategy", function () {
        it("should create sell ladder with correct price spacing", async function () {
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

            // Check price spacing
            const orderDetails = await Promise.all(
                orders.map(orderHash => lopAdapter.getOrderInfo(orderHash))
            );

            // Prices should be ascending from 3000 to 3200
            const prices = orderDetails.map(([exists, timestamp]) => timestamp);
            expect(prices[0]).to.be.lessThan(prices[prices.length - 1]);
        });
    });

    describe("Strategy Chaining", function () {
        it("should flip to sell after buy fill", async function () {
            const buyStrategy = {
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockETH.getAddress(),
                startPrice: ethers.parseEther("3000"),
                endPrice: ethers.parseEther("2800"),
                orderSize: ethers.parseEther("1000"),
                numOrders: 3,
                isBuyLadder: true,
                flipToSell: true,
                flipPercentage: 10 // 10% profit target
            };

            await testBot.createBuyLadder(buyStrategy);
            
            const initialOrders = await testBot.getActiveOrders();
            expect(initialOrders.length).to.equal(3);

            // Simulate buy order fill
            const buyOrderHash = initialOrders[0];
            await mockLOP.simulateFill(buyOrderHash);
            
            // Trigger flip to sell
            await testBot.handleOrderFill(buyOrderHash);
            
            const sellOrders = await testBot.getActiveOrders();
            expect(sellOrders.length).to.be.greaterThan(0);
        });

        it("should handle grid strategy (buy and sell simultaneously)", async function () {
            const gridStrategy = {
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockETH.getAddress(),
                startPrice: ethers.parseEther("3000"),
                endPrice: ethers.parseEther("2800"),
                orderSize: ethers.parseEther("1000"),
                numOrders: 3,
                isBuyLadder: true,
                enableGrid: true,
                gridSpacing: 5 // 5% spacing between buy/sell orders
            };

            await testBot.createGridStrategy(gridStrategy);
            
            const orders = await testBot.getActiveOrders();
            expect(orders.length).to.equal(6); // 3 buy + 3 sell orders
        });
    });

    describe("Stop Conditions", function () {
        it("should cancel orders after timeout", async function () {
            const strategy = {
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockETH.getAddress(),
                startPrice: ethers.parseEther("3000"),
                endPrice: ethers.parseEther("2800"),
                orderSize: ethers.parseEther("1000"),
                numOrders: 3,
                isBuyLadder: true,
                timeout: 3600 // 1 hour timeout
            };

            await testBot.createBuyLadder(strategy);
            
            const initialOrders = await testBot.getActiveOrders();
            expect(initialOrders.length).to.equal(3);

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");

            // Trigger timeout check
            await testBot.checkTimeouts();
            
            const updatedOrders = await testBot.getActiveOrders();
            expect(updatedOrders.length).to.equal(0);
        });

        it("should handle stop loss conditions", async function () {
            const strategy = {
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockETH.getAddress(),
                startPrice: ethers.parseEther("3000"),
                endPrice: ethers.parseEther("2800"),
                orderSize: ethers.parseEther("1000"),
                numOrders: 3,
                isBuyLadder: true,
                stopLoss: ethers.parseEther("2700") // Stop if price goes below 2700
            };

            await testBot.createBuyLadder(strategy);
            
            const initialOrders = await testBot.getActiveOrders();
            expect(initialOrders.length).to.equal(3);

            // Update price to trigger stop loss
            await oracleAdapter.updatePrice(
                await mockETH.getAddress(),
                ethers.parseEther("2600"), // Below stop loss
                Math.floor(Date.now() / 1000),
                500
            );

            // Trigger stop loss check
            await testBot.checkStopLoss();
            
            const updatedOrders = await testBot.getActiveOrders();
            expect(updatedOrders.length).to.equal(0);
        });
    });
}); 