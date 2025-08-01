const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderManager", function () {
    let orderManager;
    let owner;
    let bot1;
    let bot2;
    let user1;
    let user2;
    let mockUSDC;
    
    beforeEach(async function () {
        [owner, user1, user2, bot1, bot2] = await ethers.getSigners();
        
        // Deploy mock tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
        await mockUSDC.waitForDeployment();
        
        // Deploy OrderManager
        const OrderManager = await ethers.getContractFactory("OrderManager");
        orderManager = await OrderManager.deploy();
        await orderManager.waitForDeployment();
    });
    
    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await orderManager.owner()).to.equal(owner.address);
        });
        
        it("Should not be paused initially", async function () {
            expect(await orderManager.paused()).to.be.false;
        });
    });
    
    describe("Bot Authorization", function () {
        it("Should authorize a bot", async function () {
            await orderManager.authorizeBot(bot1.address);
            expect(await orderManager.isBotAuthorized(bot1.address)).to.be.true;
        });
        
        it("Should deauthorize a bot", async function () {
            await orderManager.authorizeBot(bot1.address);
            await orderManager.deauthorizeBot(bot1.address);
            expect(await orderManager.isBotAuthorized(bot1.address)).to.be.false;
        });
        
        it("Should only allow owner to authorize bots", async function () {
            await expect(
                orderManager.connect(user1).authorizeBot(bot1.address)
            ).to.be.revertedWithCustomError(orderManager, "OwnableUnauthorizedAccount");
        });
        
        it("Should only allow owner to deauthorize bots", async function () {
            await orderManager.authorizeBot(bot1.address);
            await expect(
                orderManager.connect(user1).deauthorizeBot(bot1.address)
            ).to.be.revertedWithCustomError(orderManager, "OwnableUnauthorizedAccount");
        });
        
        it("Should revert when authorizing zero address", async function () {
            await expect(
                orderManager.authorizeBot(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(orderManager, "ZeroAddress");
        });
    });
    
    describe("Order Registration", function () {
        const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test order"));
        const makerAsset = "0x1234567890123456789012345678901234567890";
        const takerAsset = "0x0987654321098765432109876543210987654321";
        const makingAmount = ethers.parseEther("1");
        const takingAmount = ethers.parseEther("100");
        
        beforeEach(async function () {
            await orderManager.authorizeBot(bot1.address);
        });
        
        it("Should register an order successfully", async function () {
            const tx = await orderManager.connect(bot1).registerOrder(
                orderHash,
                bot1.address,
                makerAsset,
                takerAsset,
                makingAmount,
                takingAmount
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "OrderRegistered"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.orderHash).to.equal(orderHash);
            expect(event.args.bot).to.equal(bot1.address);
            expect(event.args.orderIndex).to.equal(0);
        });
        
        it("Should revert when bot is not authorized", async function () {
            await expect(
                orderManager.connect(bot2).registerOrder(
                    orderHash,
                    bot2.address,
                    makerAsset,
                    takerAsset,
                    makingAmount,
                    takingAmount
                )
            ).to.be.revertedWithCustomError(orderManager, "UnauthorizedBot");
        });
        
        it("Should revert when registering duplicate order", async function () {
            await orderManager.connect(bot1).registerOrder(
                orderHash,
                bot1.address,
                makerAsset,
                takerAsset,
                makingAmount,
                takingAmount
            );
            
            await expect(
                orderManager.connect(bot1).registerOrder(
                    orderHash,
                    bot1.address,
                    makerAsset,
                    takerAsset,
                    makingAmount,
                    takingAmount
                )
            ).to.be.revertedWithCustomError(orderManager, "OrderAlreadyExists");
        });
        
        it("Should revert with zero address parameters", async function () {
            await expect(
                orderManager.connect(bot1).registerOrder(
                    orderHash,
                    ethers.ZeroAddress,
                    makerAsset,
                    takerAsset,
                    makingAmount,
                    takingAmount
                )
            ).to.be.revertedWithCustomError(orderManager, "ZeroAddress");
            
            await expect(
                orderManager.connect(bot1).registerOrder(
                    orderHash,
                    bot1.address,
                    ethers.ZeroAddress,
                    takerAsset,
                    makingAmount,
                    takingAmount
                )
            ).to.be.revertedWithCustomError(orderManager, "ZeroAddress");
            
            await expect(
                orderManager.connect(bot1).registerOrder(
                    orderHash,
                    bot1.address,
                    makerAsset,
                    ethers.ZeroAddress,
                    makingAmount,
                    takingAmount
                )
            ).to.be.revertedWithCustomError(orderManager, "ZeroAddress");
        });
        
        it("Should revert with zero amounts", async function () {
            await expect(
                orderManager.connect(bot1).registerOrder(
                    orderHash,
                    bot1.address,
                    makerAsset,
                    takerAsset,
                    0,
                    takingAmount
                )
            ).to.be.revertedWithCustomError(orderManager, "ZeroAmount");
            
            await expect(
                orderManager.connect(bot1).registerOrder(
                    orderHash,
                    bot1.address,
                    makerAsset,
                    takerAsset,
                    makingAmount,
                    0
                )
            ).to.be.revertedWithCustomError(orderManager, "ZeroAmount");
        });
        
        it("Should increment order counter for each bot", async function () {
            await orderManager.connect(bot1).registerOrder(
                orderHash,
                bot1.address,
                makerAsset,
                takerAsset,
                makingAmount,
                takingAmount
            );
            
            expect(await orderManager.getBotOrderCount(bot1.address)).to.equal(1);
            
            const orderHash2 = ethers.keccak256(ethers.toUtf8Bytes("test order 2"));
            await orderManager.connect(bot1).registerOrder(
                orderHash2,
                bot1.address,
                makerAsset,
                takerAsset,
                makingAmount,
                takingAmount
            );
            
            expect(await orderManager.getBotOrderCount(bot1.address)).to.equal(2);
        });
    });
    
    describe("Order Fill Updates", function () {
        const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test order"));
        const makerAsset = "0x1234567890123456789012345678901234567890";
        const takerAsset = "0x0987654321098765432109876543210987654321";
        const makingAmount = ethers.parseEther("1");
        const takingAmount = ethers.parseEther("100");
        
        beforeEach(async function () {
            await orderManager.authorizeBot(bot1.address);
            await orderManager.connect(bot1).registerOrder(
                orderHash,
                bot1.address,
                makerAsset,
                takerAsset,
                makingAmount,
                takingAmount
            );
        });
        
        it("Should update order fill successfully", async function () {
            const filledAmount = ethers.parseEther("0.5");
            const remainingAmount = ethers.parseEther("0.5");
            
            const tx = await orderManager.connect(bot1).updateOrderFill(
                orderHash,
                filledAmount,
                remainingAmount
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "OrderFilled"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.orderHash).to.equal(orderHash);
            expect(event.args.filledAmount).to.equal(filledAmount);
            expect(event.args.remainingAmount).to.equal(remainingAmount);
        });
        
        it("Should mark order as inactive when fully filled", async function () {
            const filledAmount = ethers.parseEther("1");
            const remainingAmount = 0;
            
            await orderManager.connect(bot1).updateOrderFill(
                orderHash,
                filledAmount,
                remainingAmount
            );
            
            const orderInfo = await orderManager.getOrderInfo(orderHash);
            expect(orderInfo.isActive).to.be.false;
        });
        
        it("Should revert when order does not exist", async function () {
            const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non existent"));
            
            await expect(
                orderManager.connect(bot1).updateOrderFill(
                    nonExistentHash,
                    ethers.parseEther("0.5"),
                    ethers.parseEther("0.5")
                )
            ).to.be.revertedWithCustomError(orderManager, "OrderNotFound");
        });
        
        it("Should revert when order is already canceled", async function () {
            await orderManager.connect(bot1).cancelOrder(orderHash);
            
            await expect(
                orderManager.connect(bot1).updateOrderFill(
                    orderHash,
                    ethers.parseEther("0.5"),
                    ethers.parseEther("0.5")
                )
            ).to.be.revertedWithCustomError(orderManager, "OrderAlreadyCanceled");
        });
        
        it("Should revert with invalid fill amounts", async function () {
            // Filled amount greater than making amount
            await expect(
                orderManager.connect(bot1).updateOrderFill(
                    orderHash,
                    ethers.parseEther("2"),
                    ethers.parseEther("0.5")
                )
            ).to.be.revertedWithCustomError(orderManager, "InvalidOrderData");
            
            // Remaining amount greater than current remaining
            await expect(
                orderManager.connect(bot1).updateOrderFill(
                    orderHash,
                    ethers.parseEther("0.5"),
                    ethers.parseEther("1.5")
                )
            ).to.be.revertedWithCustomError(orderManager, "InvalidOrderData");
            
            // Sum doesn't equal original amount
            await expect(
                orderManager.connect(bot1).updateOrderFill(
                    orderHash,
                    ethers.parseEther("0.3"),
                    ethers.parseEther("0.3")
                )
            ).to.be.revertedWithCustomError(orderManager, "InvalidOrderData");
        });
    });
    
    describe("Order Cancellation", function () {
        const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test order"));
        const makerAsset = "0x1234567890123456789012345678901234567890";
        const takerAsset = "0x0987654321098765432109876543210987654321";
        const makingAmount = ethers.parseEther("1");
        const takingAmount = ethers.parseEther("100");
        
        beforeEach(async function () {
            await orderManager.authorizeBot(bot1.address);
            await orderManager.connect(bot1).registerOrder(
                orderHash,
                bot1.address,
                makerAsset,
                takerAsset,
                makingAmount,
                takingAmount
            );
        });
        
        it("Should cancel order successfully", async function () {
            const tx = await orderManager.connect(bot1).cancelOrder(orderHash);
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "OrderCanceled"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.orderHash).to.equal(orderHash);
            
            const orderInfo = await orderManager.getOrderInfo(orderHash);
            expect(orderInfo.isActive).to.be.false;
        });
        
        it("Should revert when order does not exist", async function () {
            const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non existent"));
            
            await expect(
                orderManager.connect(bot1).cancelOrder(nonExistentHash)
            ).to.be.revertedWithCustomError(orderManager, "OrderNotFound");
        });
        
        it("Should revert when order is already canceled", async function () {
            await orderManager.connect(bot1).cancelOrder(orderHash);
            
            await expect(
                orderManager.connect(bot1).cancelOrder(orderHash)
            ).to.be.revertedWithCustomError(orderManager, "OrderAlreadyCanceled");
        });
        
        it("Should revert when bot is not authorized", async function () {
            await expect(
                orderManager.connect(bot2).cancelOrder(orderHash)
            ).to.be.revertedWithCustomError(orderManager, "UnauthorizedBot");
        });
    });
    
    describe("Strategy Management", function () {
        beforeEach(async function () {
            await orderManager.authorizeBot(bot1.address);
        });
        
        it("Should create strategy successfully", async function () {
            const tx = await orderManager.connect(bot1).createStrategy(
                bot1.address,
                user1.address,
                0 // Buy Ladder
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "StrategyCreated"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.bot).to.equal(bot1.address);
            expect(event.args.owner).to.equal(user1.address);
            expect(event.args.strategyType).to.equal(0);
        });
        
        it("Should revert with invalid strategy type", async function () {
            await expect(
                orderManager.connect(bot1).createStrategy(
                    bot1.address,
                    user1.address,
                    3 // Invalid type
                )
            ).to.be.revertedWithCustomError(orderManager, "InvalidStrategyType");
        });
        
        it("Should revert with zero addresses", async function () {
            await expect(
                orderManager.connect(bot1).createStrategy(
                    ethers.ZeroAddress,
                    user1.address,
                    0
                )
            ).to.be.revertedWithCustomError(orderManager, "ZeroAddress");
            
            await expect(
                orderManager.connect(bot1).createStrategy(
                    bot1.address,
                    ethers.ZeroAddress,
                    0
                )
            ).to.be.revertedWithCustomError(orderManager, "ZeroAddress");
        });
        
        it("Should update strategy statistics", async function () {
            await orderManager.connect(bot1).createStrategy(
                bot1.address,
                user1.address,
                0
            );
            
            const tx = await orderManager.connect(bot1).updateStrategy(
                bot1.address,
                5,
                3
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "StrategyUpdated"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.bot).to.equal(bot1.address);
            expect(event.args.totalOrders).to.equal(5);
            expect(event.args.activeOrders).to.equal(3);
        });
    });
    
    describe("View Functions", function () {
        const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test order"));
        const makerAsset = "0x1234567890123456789012345678901234567890";
        const takerAsset = "0x0987654321098765432109876543210987654321";
        const makingAmount = ethers.parseEther("1");
        const takingAmount = ethers.parseEther("100");
        
        beforeEach(async function () {
            await orderManager.authorizeBot(bot1.address);
            await orderManager.connect(bot1).registerOrder(
                orderHash,
                bot1.address,
                makerAsset,
                takerAsset,
                makingAmount,
                takingAmount
            );
            await orderManager.connect(bot1).createStrategy(
                bot1.address,
                user1.address,
                0
            );
        });
        
        it("Should get order info correctly", async function () {
            const orderInfo = await orderManager.getOrderInfo(orderHash);
            
            expect(orderInfo.orderHash).to.equal(orderHash);
            expect(orderInfo.bot).to.equal(bot1.address);
            expect(orderInfo.makerAsset).to.equal(makerAsset);
            expect(orderInfo.takerAsset).to.equal(takerAsset);
            expect(orderInfo.makingAmount).to.equal(makingAmount);
            expect(orderInfo.takingAmount).to.equal(takingAmount);
            expect(orderInfo.isActive).to.be.true;
        });
        
        it("Should get strategy info correctly", async function () {
            const strategyInfo = await orderManager.getStrategyInfo(bot1.address);
            
            expect(strategyInfo.bot).to.equal(bot1.address);
            expect(strategyInfo.owner).to.equal(user1.address);
            expect(strategyInfo.strategyType).to.equal(0);
            expect(strategyInfo.isActive).to.be.true;
        });
        
        it("Should get bot orders correctly", async function () {
            const orderHashes = await orderManager.getBotOrders(bot1.address);
            
            expect(orderHashes.length).to.equal(1);
            expect(orderHashes[0]).to.equal(orderHash);
        });
        
        it("Should get bot active orders correctly", async function () {
            const activeOrders = await orderManager.getBotActiveOrders(bot1.address);
            
            expect(activeOrders.length).to.equal(1);
            expect(activeOrders[0]).to.equal(orderHash);
        });
        
        it("Should revert when getting non-existent order", async function () {
            const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non existent"));
            
            await expect(
                orderManager.getOrderInfo(nonExistentHash)
            ).to.be.revertedWithCustomError(orderManager, "OrderNotFound");
        });
        
        it("Should revert when getting non-existent strategy", async function () {
            await expect(
                orderManager.getStrategyInfo(bot2.address)
            ).to.be.revertedWithCustomError(orderManager, "StrategyNotFound");
        });
    });
    
    describe("Pausable", function () {
        it("Should pause and unpause correctly", async function () {
            await orderManager.pause();
            expect(await orderManager.paused()).to.be.true;
            
            await orderManager.unpause();
            expect(await orderManager.paused()).to.be.false;
        });
        
        it("Should only allow owner to pause", async function () {
            await expect(
                orderManager.connect(user1).pause()
            ).to.be.revertedWithCustomError(orderManager, "OwnableUnauthorizedAccount");
        });
        
        it("Should only allow owner to unpause", async function () {
            await orderManager.pause();
            await expect(
                orderManager.connect(user1).unpause()
            ).to.be.revertedWithCustomError(orderManager, "OwnableUnauthorizedAccount");
        });
    });
    
    describe("Emergency Functions", function () {
        it("Should allow owner to recover stuck tokens", async function () {
            // Try to recover more tokens than the contract has
            await expect(
                orderManager.emergencyRecover(await mockUSDC.getAddress(), owner.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Transfer failed");
        });
    });
}); 