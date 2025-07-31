const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Simple Contract Tests", function () {
    let orderManager;
    let oracleAdapter;
    let factory;
    let botImplementation;
    let owner;
    let user1;
    let user2;
    let mockLop;
    let lopAdapter;
    
    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        // Deploy contracts
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
        
        // Authorize factory in OrderManager and OracleAdapter
        await orderManager.authorizeBot(await factory.getAddress());
        await oracleAdapter.authorizeUpdater(await factory.getAddress());
        await lopAdapter.authorizeUpdater(await factory.getAddress());
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

    describe("Sell-Flip Chaining", function () {
        it("Should place a sell order at +X% after a buy fill if flipToSell is enabled", async function () {
            // Deploy mock ERC20 tokens
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const usdc = await MockERC20.deploy("Mock USDC", "mUSDC", 6);
            await usdc.waitForDeployment();
            const weth = await MockERC20.deploy("Mock WETH", "mWETH", 18);
            await weth.waitForDeployment();
            // Mint USDC to user1 for budget
            await usdc.mint(user1.address, ethers.parseUnits("10000", 6));
            // Deploy a bot for user1 with flipToSell enabled and 10% flip
            const deploymentCost = ethers.parseEther("0.01");
            const tx = await factory.connect(user1).deployBot(user1.address, { value: deploymentCost });
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment && log.fragment.name === "BotDeployed");
            const botAddress = event.args.bot;
            const InchByInchBot = await ethers.getContractFactory("inchbyinchBot");
            const bot = InchByInchBot.attach(botAddress);
            
            // Get the actual owner of the bot
            const botOwnerAddr = await bot.owner();
            console.log('DEBUG: Bot owner address:', botOwnerAddr);
            const allSigners = await ethers.getSigners();
            const botOwnerSigner = allSigners.find(s => s.address.toLowerCase() === botOwnerAddr.toLowerCase());
            // Transfer USDC to bot for budget
            const transferAmount = ethers.parseUnits("1000", 6);
            await usdc.connect(botOwnerSigner).transfer(botAddress, transferAmount);
            const botUsdcBalance = await usdc.balanceOf(botAddress);
            console.log('DEBUG: Bot USDC balance before createStrategy:', botUsdcBalance.toString());
            
            // Authorize the bot in OrderManager (required for createStrategy call)
            await orderManager.authorizeBot(botAddress);
            
            // Authorize the bot in LOPAdapter (required for placeLadderOrders call)
            await lopAdapter.authorizeUpdater(botAddress);
            
            // Create a buy ladder strategy with flipToSell enabled
            await bot.connect(botOwnerSigner).createStrategy(
                weth.target, // makerAsset: WETH (what we want to buy)
                usdc.target, // takerAsset: USDC (what we spend)
                ethers.parseEther("3000"), // startPrice: $3000
                50, // spacing: 50% (percentage value)
                ethers.parseEther("0.05"), // orderSize: 0.05 WETH (within 0.001-1000 range)
                6, // numOrders
                0, // strategyType: BUY_LADDER
                2, // repostMode: REPOST_SKIP (to avoid overwriting sell order)
                ethers.parseUnits("1000", 6), // budget: 1000 USDC
                ethers.parseEther("2500"), // stopLoss: $2500
                ethers.parseEther("3500"), // takeProfit: $3500
                Math.floor(Date.now() / 1000) + 3600, // expiryTime: 1 hour
                true, // flipToSell: enabled
                10 // flipPercentage: 10%
            );
            
            // Add price data for WETH in OracleAdapter (required for placeLadderOrders)
            const currentPrice = ethers.parseEther("3000"); // $3000 per WETH
            const currentTimestamp = Math.floor(Date.now() / 1000);
            await oracleAdapter.updatePrice(weth.target, currentPrice, currentTimestamp);
            
            // Place a buy order at $2950 (simulate)
            await bot.connect(botOwnerSigner).placeLadderOrders();
            // Simulate a buy order fill at $2950
            const orderIndex = 1;
            const order = await bot.orders(orderIndex);
            const orderHash = order.orderHash;
            const fillAmount = ethers.parseEther("0.05");
            
            console.log('DEBUG: Buy order price:', ethers.formatEther(order.price));
            console.log('DEBUG: Expected sell price (2950 * 1.10):', 2950 * 1.10);
            console.log('DEBUG: Order exists:', order.isActive);
            console.log('DEBUG: Order hash:', orderHash);
            
            const fillTx = await bot.connect(botOwnerSigner).handleOrderFill(orderHash, fillAmount, 0);
            const fillReceipt = await fillTx.wait();
            
            // Check if sell-flip was triggered
            const sellFlipEvent = fillReceipt.logs.find(log => log.fragment && log.fragment.name === "SellFlipTriggered");
            if (sellFlipEvent) {
                console.log('DEBUG: Sell-flip triggered!');
                console.log('DEBUG: Order price:', ethers.formatEther(sellFlipEvent.args.orderPrice));
                console.log('DEBUG: Sell price:', ethers.formatEther(sellFlipEvent.args.sellPrice));
                console.log('DEBUG: Flip percentage:', sellFlipEvent.args.flipPercentage.toString());
            } else {
                console.log('DEBUG: Sell-flip NOT triggered');
            }
            
            // Check strategy state after fill
            const strategy = await bot.strategy();
            console.log('DEBUG: Strategy flipToSell:', strategy.flipToSell);
            console.log('DEBUG: Strategy flipSellActive:', strategy.flipSellActive);
            console.log('DEBUG: Strategy strategyType:', strategy.strategyType);
            
            // After fill, a sell order should be placed at $3000 * 1.10 = $3300
            // Check all orders to see what was placed
            let sellOrderIndex = -1;
            const currentOrderIndex = await bot.strategy().then(s => s.currentOrderIndex);
            console.log('DEBUG: Current order index after fill:', currentOrderIndex.toString());
            
            for (let i = 1; i <= currentOrderIndex; i++) {
                const order = await bot.orders(i);
                if (order.orderHash !== ethers.ZeroHash) {
                    console.log(`DEBUG: Order ${i} - Price: ${ethers.formatEther(order.price)}, Active: ${order.isActive}`);
                    // Look for sell order at approximately $3300 (3000 * 1.10)
                    const orderPrice = Number(ethers.formatEther(order.price));
                    if (Math.abs(orderPrice - 3300) < 1) {
                        console.log(`DEBUG: Found sell order at index ${i} with price ${ethers.formatEther(order.price)}`);
                        sellOrderIndex = i;
                    }
                }
            }
            
            // Check the correct sell order
            if (sellOrderIndex > 0) {
                const correctSellOrder = await bot.orders(sellOrderIndex);
                expect(correctSellOrder.isActive).to.be.true;
                // Allow for small precision differences
                const expectedSellPrice = ethers.parseEther("3300");
                const actualSellPrice = correctSellOrder.price;
                const priceDifference = Math.abs(Number(ethers.formatEther(expectedSellPrice)) - Number(ethers.formatEther(actualSellPrice)));
                expect(priceDifference).to.be.lessThan(1); // Allow 1 USD difference for precision
            } else {
                expect.fail("Sell order not found");
            }
        });
    });
}); 