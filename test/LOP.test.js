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

    describe("LOPAdapter", function () {
        it("should debug LOPAdapter", async function () {
            console.log("LOPAdapter address:", await lopAdapter.getAddress());
            console.log("MockLOP address:", await mockLOP.getAddress());
            console.log("Deployer address:", deployer.address);
            
            // Check if deployer is authorized
            const isAuthorized = await lopAdapter.isUpdaterAuthorized(deployer.address);
            console.log("Deployer authorized:", isAuthorized);
            
            // Try a simple call
            try {
                const orderHash = await lopAdapter.createOrder(
                    await mockETH.getAddress(),
                    await mockUSDC.getAddress(),
                    ethers.parseEther("1"),
                    ethers.parseEther("3000"),
                    deployer.address,
                    ethers.ZeroAddress,
                    "0x"
                );
                console.log("Order created successfully:", orderHash);
            } catch (error) {
                console.log("Error creating order:", error.message);
            }
        });

        it("should create orders correctly", async function () {
            const tx = await lopAdapter.createOrder(
                await mockETH.getAddress(),
                await mockUSDC.getAddress(),
                ethers.parseEther("1"),
                ethers.parseEther("3000"),
                deployer.address,
                ethers.ZeroAddress,
                "0x"
            );

            // Wait for transaction to be mined
            const receipt = await tx.wait();
            
            // Get the orderHash from the event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = lopAdapter.interface.parseLog(log);
                    return parsed.name === "OrderCreated";
                } catch {
                    return false;
                }
            });
            
            const parsedEvent = lopAdapter.interface.parseLog(event);
            const orderHash = parsedEvent.args.orderHash;

            expect(orderHash).to.not.equal(ethers.ZeroHash);

            const [exists, timestamp] = await lopAdapter.getOrderInfo(orderHash);
            expect(exists).to.be.true;
            expect(timestamp).to.be.greaterThan(0);
        });

        it("should cancel orders correctly", async function () {
            const tx = await lopAdapter.createOrder(
                await mockETH.getAddress(),
                await mockUSDC.getAddress(),
                ethers.parseEther("1"),
                ethers.parseEther("3000"),
                deployer.address,
                ethers.ZeroAddress,
                "0x"
            );

            // Wait for transaction to be mined
            const receipt = await tx.wait();
            
            // Get the orderHash from the event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = lopAdapter.interface.parseLog(log);
                    return parsed.name === "OrderCreated";
                } catch {
                    return false;
                }
            });
            
            const parsedEvent = lopAdapter.interface.parseLog(event);
            const orderHash = parsedEvent.args.orderHash;

            await lopAdapter.cancelOrderByHash(orderHash);
            
            const [exists, timestamp] = await lopAdapter.getOrderInfo(orderHash);
            expect(exists).to.be.false;
        });

        it("should handle order fills correctly", async function () {
            const tx = await lopAdapter.createOrder(
                await mockETH.getAddress(),
                await mockUSDC.getAddress(),
                ethers.parseEther("1"),
                ethers.parseEther("3000"),
                deployer.address,
                ethers.ZeroAddress,
                "0x"
            );

            // Wait for transaction to be mined
            const receipt = await tx.wait();
            
            // Get the orderHash from the event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = lopAdapter.interface.parseLog(log);
                    return parsed.name === "OrderCreated";
                } catch {
                    return false;
                }
            });
            
            const parsedEvent = lopAdapter.interface.parseLog(event);
            const orderHash = parsedEvent.args.orderHash;

            // Simulate order fill
            await mockLOP.simulateFill(orderHash);
            
            const [exists, timestamp] = await lopAdapter.getOrderInfo(orderHash);
            expect(exists).to.be.false; // Order should be removed after fill
        });
    });

    describe("Bot LOP Integration", function () {
        it("should debug bot token balances", async function () {
            const usdcBalance = await mockUSDC.balanceOf(await testBot.getAddress());
            const ethBalance = await mockETH.balanceOf(await testBot.getAddress());
            
            console.log("Bot USDC balance:", ethers.formatUnits(usdcBalance, 6));
            console.log("Bot ETH balance:", ethers.formatUnits(ethBalance, 18));
            
            // Try to create a simple strategy to see the exact error
            try {
                await testBot.createStrategy(
                    await mockUSDC.getAddress(),
                    await mockETH.getAddress(),
                    ethers.parseEther("3000"),
                    ethers.parseEther("100"),
                    ethers.parseEther("1000"),
                    5,
                    0, // BUY_LADDER
                    0,
                    ethers.parseEther("10000"),
                    0,
                    0,
                    Math.floor(Date.now() / 1000) + 3600,
                    false,
                    0
                );
            } catch (error) {
                console.log("createStrategy error:", error.message);
                console.log("Error data:", error.data);
            }
        });

        it("should place buy ladder orders", async function () {
            const strategy = {
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockETH.getAddress(),
                startPrice: ethers.parseEther("3000"),
                spacing: 100, // 100% spacing
                orderSize: ethers.parseEther("1000"),
                numOrders: 5,
                repostMode: 0,
                budget: ethers.parseUnits("10000", 6), // USDC has 6 decimals
                stopLoss: 0,
                takeProfit: 0,
                expiryTime: Math.floor(Date.now() / 1000) + 3600,
                flipToSell: false,
                flipPercentage: 0
            };

            await testBot.createStrategy(
                strategy.tokenIn,
                strategy.tokenOut,
                strategy.startPrice,
                strategy.spacing,
                strategy.orderSize,
                strategy.numOrders,
                0, // BUY_LADDER
                strategy.repostMode,
                strategy.budget,
                strategy.stopLoss,
                strategy.takeProfit,
                strategy.expiryTime,
                strategy.flipToSell,
                strategy.flipPercentage
            );
            await testBot.placeLadderOrders();

            const orders = await testBot.getActiveOrders();
            expect(orders.length).to.equal(5);
        });

        it("should place sell ladder orders", async function () {
            const strategy = {
                tokenIn: await mockETH.getAddress(),
                tokenOut: await mockUSDC.getAddress(),
                startPrice: ethers.parseEther("3000"),
                spacing: 100, // 100% spacing
                orderSize: ethers.parseEther("1"),
                numOrders: 5,
                repostMode: 0,
                budget: ethers.parseEther("10"), // ETH budget for sell ladder
                stopLoss: 0,
                takeProfit: 0,
                expiryTime: Math.floor(Date.now() / 1000) + 3600,
                flipToSell: false,
                flipPercentage: 0
            };

            await testBot.createStrategy(
                strategy.tokenIn,
                strategy.tokenOut,
                strategy.startPrice,
                strategy.spacing,
                strategy.orderSize,
                strategy.numOrders,
                1, // SELL_LADDER
                strategy.repostMode,
                strategy.budget,
                strategy.stopLoss,
                strategy.takeProfit,
                strategy.expiryTime,
                strategy.flipToSell,
                strategy.flipPercentage
            );
            await testBot.placeLadderOrders();

            const orders = await testBot.getActiveOrders();
            expect(orders.length).to.equal(5);
        });

        it("should handle order reposting after fills", async function () {
            const strategy = {
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockETH.getAddress(),
                startPrice: ethers.parseEther("3000"),
                spacing: 100, // 100% spacing
                orderSize: ethers.parseEther("1000"),
                numOrders: 3,
                repostMode: 1, // Repost mode
                budget: ethers.parseUnits("10000", 6), // USDC has 6 decimals
                stopLoss: 0,
                takeProfit: 0,
                expiryTime: Math.floor(Date.now() / 1000) + 3600,
                flipToSell: false,
                flipPercentage: 0
            };

            await testBot.createStrategy(
                strategy.tokenIn,
                strategy.tokenOut,
                strategy.startPrice,
                strategy.spacing,
                strategy.orderSize,
                strategy.numOrders,
                0, // BUY_LADDER
                strategy.repostMode,
                strategy.budget,
                strategy.stopLoss,
                strategy.takeProfit,
                strategy.expiryTime,
                strategy.flipToSell,
                strategy.flipPercentage
            );
            await testBot.placeLadderOrders();
            
            const initialOrders = await testBot.getActiveOrderHashes();
            expect(initialOrders.length).to.equal(3);

            // Simulate fill of first order
            const firstOrderHash = initialOrders[0];
            await mockLOP.simulateFill(firstOrderHash);
            
            // Trigger reposting - simulate a partial fill
            // For a buy order, makingAmount is ETH, takingAmount is USDC
            // Let's simulate a 50% fill of the original order
            await testBot.handleOrderFill(firstOrderHash, ethers.parseEther("500"), ethers.parseEther("500"));
            
            const updatedOrders = await testBot.getActiveOrderHashes();
            expect(updatedOrders.length).to.equal(3); // Should still have 3 orders
        });

        it("should debug createStrategy error", async function () {
            // Check if bot is authorized
            const isAuthorized = await orderManager.isBotAuthorized(await testBot.getAddress());
            console.log("Bot authorized:", isAuthorized);
            
            // Check if strategy already exists
            try {
                const strategyInfo = await orderManager.getStrategyInfo(await testBot.getAddress());
                console.log("Strategy exists:", strategyInfo.bot !== ethers.ZeroAddress);
            } catch (e) {
                console.log("No strategy exists yet");
            }
            
            // Try to create strategy with minimal parameters
            try {
                await testBot.createStrategy(
                    await mockUSDC.getAddress(),
                    await mockETH.getAddress(),
                    ethers.parseEther("3000"),
                    100, // 100% spacing
                    ethers.parseEther("1000"),
                    5,
                    0, // BUY_LADDER
                    0, // repostMode
                    ethers.parseUnits("10000", 6),
                    0, // stopLoss
                    0, // takeProfit
                    Math.floor(Date.now() / 1000) + 3600,
                    false, // flipToSell
                    0 // flipPercentage
                );
                console.log("createStrategy succeeded");
            } catch (error) {
                console.log("createStrategy error:", error.message);
                console.log("Error data:", error.data);
            }
        });

        it("should debug LOPAdapter authorization", async function () {
            // Check if bot is authorized in LOPAdapter
            const isAuthorized = await lopAdapter.authorizedUpdaters(await testBot.getAddress());
            console.log("Bot authorized in LOPAdapter:", isAuthorized);
            
            // Check if bot is owner of LOPAdapter
            const lopAdapterOwner = await lopAdapter.owner();
            console.log("LOPAdapter owner:", lopAdapterOwner);
            console.log("Bot address:", await testBot.getAddress());
            
            // Try to create a simple order to see the exact error
            try {
                const makingAmount = ethers.parseUnits("1000", 6);
                const takingAmount = ethers.parseEther("1");
                console.log("makingAmount:", makingAmount.toString());
                console.log("takingAmount:", takingAmount.toString());
                console.log("makerAsset:", await mockUSDC.getAddress());
                console.log("takerAsset:", await mockETH.getAddress());
                
                await lopAdapter.createOrder(
                    await mockUSDC.getAddress(),
                    await mockETH.getAddress(),
                    makingAmount,
                    takingAmount,
                    await testBot.getAddress(), // receiver
                    ethers.ZeroAddress, // allowedSender
                    "0x" // interactions
                );
                console.log("createOrder succeeded");
            } catch (error) {
                console.log("createOrder error:", error.message);
                console.log("Error data:", error.data);
            }
        });
    });
}); 