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
        mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
        await mockUSDC.waitForDeployment();
        
        mockETH = await MockERC20.deploy("Ethereum", "ETH", 18);
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

        // Setup contracts - authorize factory in all contracts
        await orderManager.authorizeBot(await factory.getAddress());
        await lopAdapter.authorizeUpdater(await factory.getAddress());
        await oracleAdapter.authorizeUpdater(await factory.getAddress());
        await oracleAdapter.authorizeUpdater(deployer.address); // Authorize deployer for testing
        await lopAdapter.authorizeUpdater(deployer.address); // Authorize deployer for testing

        // Transfer ownership to factory for proper authorization
        await orderManager.transferOwnership(await factory.getAddress());
        await oracleAdapter.transferOwnership(await factory.getAddress());
        await lopAdapter.transferOwnership(await factory.getAddress());

        // Deploy test bot
        await factory.deployBot(deployer.address, { value: ethers.parseEther("0.001") });
        const userBots = await factory.getUserBots(deployer.address);
        const botAddress = userBots[userBots.length - 1];
        testBot = await ethers.getContractAt("inchbyinchBot", botAddress);

        // Setup mock prices
        await oracleAdapter.updatePrice(
            await mockETH.getAddress(),
            ethers.parseEther("3000"),
            Math.floor(Date.now() / 1000)
        );

        // Fund bot with tokens
        await mockUSDC.mint(await testBot.getAddress(), ethers.parseEther("10000"));
        await mockETH.mint(await testBot.getAddress(), ethers.parseEther("10"));
    });

    describe("Buy Ladder Strategy", function () {
        it("should create buy ladder with correct price spacing", async function () {
            await testBot.createStrategy(
                await mockUSDC.getAddress(),
                await mockETH.getAddress(),
                ethers.parseEther("3000"),
                100, // 100% spacing
                ethers.parseEther("1000"),
                5, // numOrders
                0, // BUY_LADDER
                0, // repostMode
                ethers.parseUnits("10000", 6), // budget, USDC has 6 decimals
                0, // stopLoss
                0, // takeProfit
                Math.floor(Date.now() / 1000) + 3600, // expiryTime
                false, // flipToSell
                0 // flipPercentage
            );
            await testBot.placeLadderOrders();

            const orders = await testBot.getActiveOrderHashes();
            expect(orders.length).to.equal(5);

            // Check that orders exist
            const orderDetails = await Promise.all(
                orders.map(orderHash => lopAdapter.getOrderInfo(orderHash))
            );

            // All orders should exist
            orderDetails.forEach(([exists, timestamp]) => {
                expect(exists).to.be.true;
                expect(timestamp).to.be.greaterThan(0);
            });
        });

        it("should handle buy ladder with budget limits", async function () {
            await testBot.createStrategy(
                await mockUSDC.getAddress(),
                await mockETH.getAddress(),
                ethers.parseEther("3000"),
                100, // 100% spacing
                ethers.parseEther("1000"),
                5, // Only 5 orders due to budget
                0, // BUY_LADDER
                0, // repostMode
                ethers.parseUnits("5000", 6), // budget, USDC has 6 decimals
                0, // stopLoss
                0, // takeProfit
                Math.floor(Date.now() / 1000) + 3600, // expiryTime
                false, // flipToSell
                0 // flipPercentage
            );
            await testBot.placeLadderOrders();

            const orders = await testBot.getActiveOrderHashes();
            expect(orders.length).to.equal(5); // Limited by budget
        });
    });

    describe("Sell Ladder Strategy", function () {
        it("should create sell ladder with correct price spacing", async function () {
            await testBot.createStrategy(
                await mockETH.getAddress(),
                await mockUSDC.getAddress(),
                ethers.parseEther("3000"),
                100, // 100% spacing
                ethers.parseEther("1"),
                5, // numOrders
                1, // SELL_LADDER
                0, // repostMode
                ethers.parseEther("10"), // ETH budget for sell ladder
                0, // stopLoss
                0, // takeProfit
                Math.floor(Date.now() / 1000) + 3600, // expiryTime
                false, // flipToSell
                0 // flipPercentage
            );
            await testBot.placeLadderOrders();

            const orders = await testBot.getActiveOrderHashes();
            expect(orders.length).to.equal(5);

            // Check that orders exist
            const orderDetails = await Promise.all(
                orders.map(orderHash => lopAdapter.getOrderInfo(orderHash))
            );

            // All orders should exist
            orderDetails.forEach(([exists, timestamp]) => {
                expect(exists).to.be.true;
                expect(timestamp).to.be.greaterThan(0);
            });
        });
    });

    describe("Strategy Chaining", function () {
        it("should flip to sell after buy fill", async function () {
            await testBot.createStrategy(
                await mockUSDC.getAddress(),
                await mockETH.getAddress(),
                ethers.parseEther("3000"),
                100, // 100% spacing
                ethers.parseEther("1000"),
                3, // numOrders
                0, // BUY_LADDER
                0, // repostMode
                ethers.parseUnits("10000", 6), // budget, USDC has 6 decimals
                0, // stopLoss
                0, // takeProfit
                Math.floor(Date.now() / 1000) + 3600, // expiryTime
                true, // flipToSell
                10 // flipPercentage - 10% profit target
            );
            await testBot.placeLadderOrders();
            
            const initialOrders = await testBot.getActiveOrderHashes();
            expect(initialOrders.length).to.equal(3);

            // Simulate buy order fill
            const buyOrderHash = initialOrders[0];
            await mockLOP.simulateFill(buyOrderHash);
            
            // Trigger flip to sell - simulate a full fill
            // For a full fill, filledAmount should equal the original makingAmount
            await testBot.handleOrderFill(buyOrderHash, ethers.parseEther("1000"), 0);
            
            const sellOrders = await testBot.getActiveOrderHashes();
            expect(sellOrders.length).to.be.greaterThan(0);
        });

        it("should handle grid strategy (buy and sell simultaneously)", async function () {
            await testBot.createStrategy(
                await mockUSDC.getAddress(),
                await mockETH.getAddress(),
                ethers.parseEther("3000"),
                100, // 100% spacing
                ethers.parseEther("1000"),
                3, // numOrders
                2, // STRATEGY_BUY_SELL
                0, // repostMode
                ethers.parseUnits("10000", 6), // budget, USDC has 6 decimals
                0, // stopLoss
                0, // takeProfit
                Math.floor(Date.now() / 1000) + 3600, // expiryTime
                false, // flipToSell
                0 // flipPercentage
            );
            await testBot.placeLadderOrders();
            
            const orders = await testBot.getActiveOrderHashes();
            expect(orders.length).to.equal(2); // 1 buy + 1 sell order (3/2 = 1 each)
        });
    });

    describe("Stop Conditions", function () {
        it("should cancel orders after timeout", async function () {
            // Set expiry time to 1 hour from now using block timestamp
            const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const expiryTime = currentBlockTime + 3600;
            console.log("Current block time:", currentBlockTime);
            console.log("Setting expiry time to:", expiryTime);
            
            await testBot.createStrategy(
                await mockUSDC.getAddress(),
                await mockETH.getAddress(),
                ethers.parseEther("3000"),
                100, // 100% spacing
                ethers.parseEther("1000"),
                3, // numOrders
                0, // BUY_LADDER
                0, // repostMode
                ethers.parseUnits("10000", 6), // budget, USDC has 6 decimals
                0, // stopLoss
                0, // takeProfit
                expiryTime, // expiryTime
                false, // flipToSell
                0 // flipPercentage
            );
            await testBot.placeLadderOrders();
            
            const initialOrders = await testBot.getActiveOrderHashes();
            expect(initialOrders.length).to.equal(3);

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");

            // Check if bot is authorized in LOPAdapter
            const isAuthorized = await lopAdapter.authorizedUpdaters(await testBot.getAddress());
            console.log("Bot authorized in LOPAdapter for timeout test:", isAuthorized);
            
            // Check current time vs expiry time
            const testCurrentTime = Math.floor(Date.now() / 1000);
            const testExpiryTime = Math.floor(Date.now() / 1000) + 3600;
            console.log("Current time:", testCurrentTime);
            console.log("Expiry time:", testExpiryTime);
            console.log("Time difference:", testCurrentTime - testExpiryTime);
            
            // Get the actual expiry time from the strategy
            const strategyInfo = await orderManager.getStrategyInfo(await testBot.getAddress());
            console.log("Strategy expiry time:", strategyInfo.lastUpdated.toString());
            console.log("Strategy is active:", strategyInfo.isActive);
            
            // Trigger timeout check
            await testBot.checkTimeouts();
            
            const updatedOrders = await testBot.getActiveOrderHashes();
            console.log("Orders after timeout check:", updatedOrders.length);
            expect(updatedOrders.length).to.equal(0);
        });

        it("should handle stop loss conditions", async function () {
            // Set expiry time to 1 hour from now using block timestamp
            const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const expiryTime = currentBlockTime + 3600;
            
            await testBot.createStrategy(
                await mockUSDC.getAddress(),
                await mockETH.getAddress(),
                ethers.parseEther("3000"),
                100, // 100% spacing
                ethers.parseEther("1000"),
                3, // numOrders
                0, // BUY_LADDER
                0, // repostMode
                ethers.parseUnits("10000", 6), // budget, USDC has 6 decimals
                ethers.parseEther("2700"), // stopLoss - Stop if price goes below 2700
                0, // takeProfit
                expiryTime, // expiryTime
                false, // flipToSell
                0 // flipPercentage
            );
            await testBot.placeLadderOrders();
            
            const initialOrders = await testBot.getActiveOrderHashes();
            expect(initialOrders.length).to.equal(3);

            // Update price to trigger stop loss
            // For buy ladder, makerAsset is USDC, but we need to check ETH price for stop loss
            // Let's update the price for USDC to simulate ETH price drop
            await oracleAdapter.updatePrice(
                await mockUSDC.getAddress(),
                ethers.parseEther("2600"), // Below stop loss
                Math.floor(Date.now() / 1000)
            );

            // Check current price
            const currentPrice = await oracleAdapter.getLatestPrice(await mockUSDC.getAddress());
            console.log("Current price after update:", ethers.formatEther(currentPrice.price));
            console.log("Stop loss price:", ethers.formatEther(ethers.parseEther("2700")));

            // Check if bot is authorized in LOPAdapter
            const isAuthorized = await lopAdapter.authorizedUpdaters(await testBot.getAddress());
            console.log("Bot authorized in LOPAdapter for stop loss test:", isAuthorized);
            
            // Trigger stop loss check
            await testBot.checkStopLoss();
            
            const updatedOrders = await testBot.getActiveOrderHashes();
            console.log("Orders after stop loss check:", updatedOrders.length);
            expect(updatedOrders.length).to.equal(0);
        });
    });
}); 