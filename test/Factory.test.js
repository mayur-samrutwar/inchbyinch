const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("inchbyinchFactory", function () {
    let factory;
    let orderManager;
    let oracleAdapter;
    let botImplementation;
    let lopAdapter;
    let owner;
    let user1;
    let user2;
    let user3;
    
    const LOP_ADDRESS = "0x3ef51736315F52d568D6D2cf289419b9CfffE782";
    const MIN_DEPOSIT = ethers.parseEther("0.01");
    const MAX_DEPOSIT = ethers.parseEther("1000");
    
    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy dependencies
        const OrderManager = await ethers.getContractFactory("OrderManager");
        orderManager = await OrderManager.deploy();
        await orderManager.waitForDeployment();
        
        const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
        oracleAdapter = await OracleAdapter.deploy();
        await oracleAdapter.waitForDeployment();
        
        const InchByInchBot = await ethers.getContractFactory("inchbyinchBot");
        botImplementation = await InchByInchBot.deploy();
        await botImplementation.waitForDeployment();
        
        // Deploy LOPAdapter
        const LOPAdapter = await ethers.getContractFactory("LOPAdapter");
        lopAdapter = await LOPAdapter.deploy(LOP_ADDRESS);
        await lopAdapter.waitForDeployment();
        
        // Deploy factory
        const InchByInchFactory = await ethers.getContractFactory("inchbyinchFactory");
        factory = await InchByInchFactory.deploy(
            await botImplementation.getAddress(),
            await orderManager.getAddress(),
            await oracleAdapter.getAddress(),
            LOP_ADDRESS,
            await lopAdapter.getAddress()
        );
        await factory.waitForDeployment();
        
        // Authorize factory
        await orderManager.authorizeBot(await factory.getAddress());
        await oracleAdapter.authorizeUpdater(await factory.getAddress());
    });
    
    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await factory.owner()).to.equal(owner.address);
        });
        
        it("Should set the correct implementation addresses", async function () {
            expect(await factory.getBotImplementation()).to.equal(await botImplementation.getAddress());
        });
        
        it("Should get factory configuration correctly", async function () {
            const config = await factory.getFactoryConfig();
            
            expect(config[0]).to.equal(await orderManager.getAddress()); // orderManager
            expect(config[1]).to.equal(await oracleAdapter.getAddress()); // oracleAdapter
            expect(config[2]).to.equal(LOP_ADDRESS); // lop
            expect(config[3]).to.equal(10); // maxBotsPerUser
            expect(config[4]).to.equal(MIN_DEPOSIT); // minDeposit
            expect(config[5]).to.equal(MAX_DEPOSIT); // maxDeposit
        });
        
        it("Should not be paused initially", async function () {
            expect(await factory.paused()).to.be.false;
        });
    });
    
    describe("Bot Deployment", function () {
        it("Should deploy a bot successfully", async function () {
            const tx = await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "BotDeployed"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.user).to.equal(user1.address);
            expect(event.args.botIndex).to.equal(0);
            expect(event.args.deploymentCost).to.equal(MIN_DEPOSIT);
            
            // Check that bot was deployed
            const deployedBot = event.args.bot;
            expect(deployedBot).to.not.equal(ethers.ZeroAddress);
            
            // Check user bots
            const userBots = await factory.getUserBots(user1.address);
            expect(userBots.length).to.equal(1);
            expect(userBots[0]).to.equal(deployedBot);
            
            // Check deployment count
            const deploymentCount = await factory.getUserDeploymentCount(user1.address);
            expect(deploymentCount).to.equal(1);
        });
        
        it("Should revert with insufficient deposit", async function () {
            const insufficientDeposit = ethers.parseEther("0.005");
            
            await expect(
                factory.connect(user1).deployBot(user1.address, { value: insufficientDeposit })
            ).to.be.revertedWithCustomError(factory, "InsufficientDeposit");
        });
        
        it("Should revert with excessive deposit", async function () {
            const excessiveDeposit = ethers.parseEther("2000");
            
            await expect(
                factory.connect(user1).deployBot(user1.address, { value: excessiveDeposit })
            ).to.be.revertedWithCustomError(factory, "ExcessiveDeposit");
        });
        
        it("Should revert with zero address", async function () {
            await expect(
                factory.connect(user1).deployBot(ethers.ZeroAddress, { value: MIN_DEPOSIT })
            ).to.be.revertedWithCustomError(factory, "ZeroAddress");
        });
        
        it("Should enforce user limit", async function () {
            // Deploy 10 bots (max limit)
            for (let i = 0; i < 10; i++) {
                await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            }
            
            // Try to deploy 11th bot
            await expect(
                factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT })
            ).to.be.revertedWithCustomError(factory, "UserLimitExceeded");
        });
        
        it("Should allow multiple users to deploy bots", async function () {
            // User 1 deploys bot
            await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            
            // User 2 deploys bot
            await factory.connect(user2).deployBot(user2.address, { value: MIN_DEPOSIT });
            
            // Check user bots
            const user1Bots = await factory.getUserBots(user1.address);
            const user2Bots = await factory.getUserBots(user2.address);
            
            expect(user1Bots.length).to.equal(1);
            expect(user2Bots.length).to.equal(1);
            expect(user1Bots[0]).to.not.equal(user2Bots[0]);
        });
    });
    
    describe("Multiple Bot Deployment", function () {
        it("Should deploy multiple bots successfully", async function () {
            const count = 3;
            const totalDeposit = MIN_DEPOSIT * BigInt(count);
            
            const tx = await factory.connect(user1).deployMultipleBots(user1.address, count, { value: totalDeposit });
            const receipt = await tx.wait();
            
            // Check events
            const events = receipt.logs.filter(log => 
                log.fragment && log.fragment.name === "BotDeployed"
            );
            
            expect(events.length).to.equal(count);
            
            // Check user bots
            const userBots = await factory.getUserBots(user1.address);
            expect(userBots.length).to.equal(count);
            
            // Check deployment count
            const deploymentCount = await factory.getUserDeploymentCount(user1.address);
            expect(deploymentCount).to.equal(count);
        });
        
        it("Should revert with zero count", async function () {
            await expect(
                factory.connect(user1).deployMultipleBots(user1.address, 0, { value: MIN_DEPOSIT })
            ).to.be.revertedWithCustomError(factory, "ZeroAmount");
        });
        
        it("Should revert with count > 5", async function () {
            await expect(
                factory.connect(user1).deployMultipleBots(user1.address, 6, { value: MIN_DEPOSIT * 6n })
            ).to.be.revertedWithCustomError(factory, "ZeroAmount");
        });
        
        it("Should revert when exceeding user limit", async function () {
            // Deploy 8 bots first
            for (let i = 0; i < 8; i++) {
                await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            }
            
            // Try to deploy 3 more (would exceed limit)
            await expect(
                factory.connect(user1).deployMultipleBots(user1.address, 3, { value: MIN_DEPOSIT * 3n })
            ).to.be.revertedWithCustomError(factory, "UserLimitExceeded");
        });
        
        it("Should revert with insufficient deposit for multiple bots", async function () {
            const count = 3;
            const insufficientDeposit = MIN_DEPOSIT * 2n; // Only 2 deposits for 3 bots
            
            await expect(
                factory.connect(user1).deployMultipleBots(user1.address, count, { value: insufficientDeposit })
            ).to.be.revertedWithCustomError(factory, "InsufficientDeposit");
        });
    });
    
    describe("Bot Upgrades", function () {
        let deployedBot;
        
        beforeEach(async function () {
            // Deploy a bot first
            const tx = await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "BotDeployed"
            );
            deployedBot = event.args.bot;
        });
        
        it("Should upgrade bot successfully", async function () {
            const tx = await factory.connect(user1).upgradeBot(user1.address, 0, { value: MIN_DEPOSIT });
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "BotUpgraded"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.user).to.equal(user1.address);
            expect(event.args.oldBot).to.equal(deployedBot);
            expect(event.args.newBot).to.not.equal(deployedBot);
            
            // Check that bot was replaced
            const userBots = await factory.getUserBots(user1.address);
            expect(userBots[0]).to.equal(event.args.newBot);
        });
        
        it("Should revert when upgrading non-existent bot", async function () {
            await expect(
                factory.connect(user1).upgradeBot(user1.address, 1, { value: MIN_DEPOSIT })
            ).to.be.revertedWithCustomError(factory, "BotNotFound");
        });
        
        it("Should revert when upgrading zero address bot", async function () {
            // This would require manipulating the storage, but we can test the error
            await expect(
                factory.connect(user1).upgradeBot(user1.address, 999, { value: MIN_DEPOSIT })
            ).to.be.revertedWithCustomError(factory, "BotNotFound");
        });
        
        it("Should revert with insufficient deposit", async function () {
            const insufficientDeposit = ethers.parseEther("0.005");
            
            await expect(
                factory.connect(user1).upgradeBot(user1.address, 0, { value: insufficientDeposit })
            ).to.be.revertedWithCustomError(factory, "InsufficientDeposit");
        });
    });
    
    describe("View Functions", function () {
        let deployedBot;
        
        beforeEach(async function () {
            // Deploy a bot
            const tx = await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "BotDeployed"
            );
            deployedBot = event.args.bot;
        });
        
        it("Should get user bots correctly", async function () {
            const userBots = await factory.getUserBots(user1.address);
            
            expect(userBots.length).to.equal(1);
            expect(userBots[0]).to.equal(deployedBot);
        });
        
        it("Should get specific user bot", async function () {
            const bot = await factory.getUserBot(user1.address, 0);
            expect(bot).to.equal(deployedBot);
        });
        
        it("Should revert when getting non-existent bot", async function () {
            await expect(
                factory.getUserBot(user1.address, 1)
            ).to.be.revertedWithCustomError(factory, "BotNotFound");
        });
        
        it("Should get user bot count", async function () {
            const count = await factory.getUserBotCount(user1.address);
            expect(count).to.equal(1);
        });
        
        it("Should get user deployment count", async function () {
            const count = await factory.getUserDeploymentCount(user1.address);
            expect(count).to.equal(1);
        });
        
        it("Should return empty array for user with no bots", async function () {
            const userBots = await factory.getUserBots(user2.address);
            expect(userBots.length).to.equal(0);
        });
    });
    
    describe("Token Authorization", function () {
        const tokenAddress = "0x1234567890123456789012345678901234567890";
        
        it("Should authorize token", async function () {
            const tx = await factory.authorizeToken(tokenAddress);
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "TokenAuthorized"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.token).to.equal(tokenAddress);
            
            expect(await factory.isTokenAuthorized(tokenAddress)).to.be.true;
        });
        
        it("Should deauthorize token", async function () {
            await factory.authorizeToken(tokenAddress);
            await factory.deauthorizeToken(tokenAddress);
            
            expect(await factory.isTokenAuthorized(tokenAddress)).to.be.false;
        });
        
        it("Should only allow owner to authorize tokens", async function () {
            await expect(
                factory.connect(user1).authorizeToken(tokenAddress)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
        
        it("Should only allow owner to deauthorize tokens", async function () {
            await factory.authorizeToken(tokenAddress);
            await expect(
                factory.connect(user1).deauthorizeToken(tokenAddress)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
        
        it("Should revert when authorizing zero address", async function () {
            await expect(
                factory.authorizeToken(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(factory, "ZeroAddress");
        });
    });
    
    describe("Withdrawal Functions", function () {
        it("Should allow owner to withdraw ETH", async function () {
            // First, send some ETH to the factory
            await user1.sendTransaction({
                to: await factory.getAddress(),
                value: ethers.parseEther("1")
            });
            
            const balanceBefore = await ethers.provider.getBalance(owner.address);
            const withdrawAmount = ethers.parseEther("0.5");
            
            await factory.withdrawETH(withdrawAmount);
            
            const balanceAfter = await ethers.provider.getBalance(owner.address);
            expect(balanceAfter).to.be.gt(balanceBefore);
        });
        
        it("Should revert when withdrawing more than balance", async function () {
            await expect(
                factory.withdrawETH(ethers.parseEther("1000"))
            ).to.be.revertedWith("Insufficient balance");
        });
        
        it("Should revert when withdrawing zero amount", async function () {
            await expect(
                factory.withdrawETH(0)
            ).to.be.revertedWithCustomError(factory, "ZeroAmount");
        });
        
        it("Should only allow owner to withdraw ETH", async function () {
            await expect(
                factory.connect(user1).withdrawETH(ethers.parseEther("0.1"))
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
        
        it("Should allow owner to withdraw tokens", async function () {
            // This would require a mock token, but we can test the function exists
            const mockToken = "0x1234567890123456789012345678901234567890";
            const mockAmount = ethers.parseEther("1");
            
            // Should revert due to insufficient balance, but not due to access control
            await expect(
                factory.withdrawTokens(mockToken, mockAmount)
            ).to.be.revertedWith("Insufficient balance");
        });
        
        it("Should only allow owner to withdraw tokens", async function () {
            const mockToken = "0x1234567890123456789012345678901234567890";
            const mockAmount = ethers.parseEther("1");
            
            await expect(
                factory.connect(user1).withdrawTokens(mockToken, mockAmount)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
    });
    
    describe("Emergency Functions", function () {
        it("Should allow owner to recover stuck tokens", async function () {
            const mockToken = "0x1234567890123456789012345678901234567890";
            const mockAmount = ethers.parseEther("1");
            
            // Should revert due to insufficient balance, but not due to access control
            await expect(
                factory.emergencyRecover(mockToken, user1.address, mockAmount)
            ).to.be.revertedWith("Insufficient balance");
        });
        
        it("Should only allow owner to recover tokens", async function () {
            const mockToken = "0x1234567890123456789012345678901234567890";
            const mockAmount = ethers.parseEther("1");
            
            await expect(
                factory.connect(user1).emergencyRecover(mockToken, user1.address, mockAmount)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
        
        it("Should revert with zero address parameters", async function () {
            const mockToken = "0x1234567890123456789012345678901234567890";
            const mockAmount = ethers.parseEther("1");
            
            await expect(
                factory.emergencyRecover(ethers.ZeroAddress, user1.address, mockAmount)
            ).to.be.revertedWithCustomError(factory, "ZeroAddress");
            
            await expect(
                factory.emergencyRecover(mockToken, ethers.ZeroAddress, mockAmount)
            ).to.be.revertedWithCustomError(factory, "ZeroAddress");
        });
        
        it("Should revert with zero amount", async function () {
            const mockToken = "0x1234567890123456789012345678901234567890";
            
            await expect(
                factory.emergencyRecover(mockToken, user1.address, 0)
            ).to.be.revertedWithCustomError(factory, "ZeroAmount");
        });
    });
    
    describe("Pausable", function () {
        it("Should pause and unpause correctly", async function () {
            await factory.pause();
            expect(await factory.paused()).to.be.true;
            
            await factory.unpause();
            expect(await factory.paused()).to.be.false;
        });
        
        it("Should only allow owner to pause", async function () {
            await expect(
                factory.connect(user1).pause()
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
        
        it("Should only allow owner to unpause", async function () {
            await factory.pause();
            await expect(
                factory.connect(user1).unpause()
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
    });
    
    describe("Receive and Fallback", function () {
        it("Should accept ETH via receive function", async function () {
            const amount = ethers.parseEther("1");
            const balanceBefore = await ethers.provider.getBalance(await factory.getAddress());
            
            await user1.sendTransaction({
                to: await factory.getAddress(),
                value: amount
            });
            
            const balanceAfter = await ethers.provider.getBalance(await factory.getAddress());
            expect(balanceAfter).to.equal(balanceBefore + amount);
        });
        
        it("Should accept ETH via fallback function", async function () {
            const amount = ethers.parseEther("1");
            const balanceBefore = await ethers.provider.getBalance(await factory.getAddress());
            
            await user1.sendTransaction({
                to: await factory.getAddress(),
                value: amount,
                data: "0x1234" // Some data to trigger fallback
            });
            
            const balanceAfter = await ethers.provider.getBalance(await factory.getAddress());
            expect(balanceAfter).to.equal(balanceBefore + amount);
        });
    });
    
    describe("Edge Cases", function () {
        it("Should handle multiple deployments correctly", async function () {
            // Deploy multiple bots
            for (let i = 0; i < 5; i++) {
                await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            }
            
            const userBots = await factory.getUserBots(user1.address);
            expect(userBots.length).to.equal(5);
            
            // All bots should be different addresses
            const uniqueBots = new Set(userBots.map(bot => bot.toLowerCase()));
            expect(uniqueBots.size).to.equal(5);
        });
        
        it("Should handle upgrade after multiple deployments", async function () {
            // Deploy multiple bots
            for (let i = 0; i < 3; i++) {
                await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            }
            
            // Upgrade the second bot
            const userBots = await factory.getUserBots(user1.address);
            const originalBot = userBots[1];
            
            await factory.connect(user1).upgradeBot(user1.address, 1, { value: MIN_DEPOSIT });
            
            const updatedBots = await factory.getUserBots(user1.address);
            expect(updatedBots[1]).to.not.equal(originalBot);
            expect(updatedBots[0]).to.equal(userBots[0]); // First bot unchanged
            expect(updatedBots[2]).to.equal(userBots[2]); // Third bot unchanged
        });
        
        it("Should handle deployment count correctly", async function () {
            // Deploy bots for multiple users
            await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            await factory.connect(user2).deployBot(user2.address, { value: MIN_DEPOSIT });
            await factory.connect(user1).deployBot(user1.address, { value: MIN_DEPOSIT });
            
            expect(await factory.getUserDeploymentCount(user1.address)).to.equal(2);
            expect(await factory.getUserDeploymentCount(user2.address)).to.equal(1);
            expect(await factory.getUserDeploymentCount(user3.address)).to.equal(0);
        });
    });
}); 