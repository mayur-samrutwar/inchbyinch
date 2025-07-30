const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OracleAdapter", function () {
    let oracleAdapter;
    let owner;
    let updater1;
    let updater2;
    let user1;
    let user2;
    
    const ETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const USDC_ADDRESS = "0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8C";
    
    beforeEach(async function () {
        [owner, updater1, updater2, user1, user2] = await ethers.getSigners();
        
        const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
        oracleAdapter = await OracleAdapter.deploy();
        await oracleAdapter.waitForDeployment();
    });
    
    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await oracleAdapter.owner()).to.equal(owner.address);
        });
        
        it("Should not be paused initially", async function () {
            expect(await oracleAdapter.paused()).to.be.false;
        });
    });
    
    describe("Updater Authorization", function () {
        it("Should authorize an updater", async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
            expect(await oracleAdapter.isUpdaterAuthorized(updater1.address)).to.be.true;
        });
        
        it("Should deauthorize an updater", async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
            await oracleAdapter.deauthorizeUpdater(updater1.address);
            expect(await oracleAdapter.isUpdaterAuthorized(updater1.address)).to.be.false;
        });
        
        it("Should only allow owner to authorize updaters", async function () {
            await expect(
                oracleAdapter.connect(user1).authorizeUpdater(updater1.address)
            ).to.be.revertedWithCustomError(oracleAdapter, "OwnableUnauthorizedAccount");
        });
        
        it("Should only allow owner to deauthorize updaters", async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
            await expect(
                oracleAdapter.connect(user1).deauthorizeUpdater(updater1.address)
            ).to.be.revertedWithCustomError(oracleAdapter, "OwnableUnauthorizedAccount");
        });
        
        it("Should revert when authorizing zero address", async function () {
            await expect(
                oracleAdapter.authorizeUpdater(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(oracleAdapter, "ZeroAddress");
        });
        
        it("Should allow owner to update prices without authorization", async function () {
            const price = ethers.parseEther("3000");
            const timestamp = Math.floor(Date.now() / 1000);
            
            await oracleAdapter.updatePrice(ETH_ADDRESS, price, timestamp);
            
            const priceData = await oracleAdapter.getLatestPrice(ETH_ADDRESS);
            expect(priceData.price).to.equal(price);
            expect(priceData.timestamp).to.equal(timestamp);
        });
    });
    
    describe("Price Updates", function () {
        beforeEach(async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
        });
        
        it("Should update price successfully", async function () {
            const price = ethers.parseEther("3000");
            const timestamp = Math.floor(Date.now() / 1000);
            
            const tx = await oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, price, timestamp);
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "PriceUpdated"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.asset).to.equal(ETH_ADDRESS);
            expect(event.args.price).to.equal(price);
            expect(event.args.timestamp).to.equal(timestamp);
        });
        
        it("Should revert with zero price", async function () {
            const timestamp = Math.floor(Date.now() / 1000);
            
            await expect(
                oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, 0, timestamp)
            ).to.be.revertedWithCustomError(oracleAdapter, "InvalidPrice");
        });
        
        it("Should revert with invalid timestamp", async function () {
            const price = ethers.parseEther("3000");
            const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
            
            await expect(
                oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, price, futureTimestamp)
            ).to.be.revertedWithCustomError(oracleAdapter, "InvalidTimestamp");
        });
        
        it("Should revert with zero timestamp", async function () {
            const price = ethers.parseEther("3000");
            
            await expect(
                oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, price, 0)
            ).to.be.revertedWithCustomError(oracleAdapter, "InvalidTimestamp");
        });
        
        it("Should revert when updater is not authorized", async function () {
            const price = ethers.parseEther("3000");
            const timestamp = Math.floor(Date.now() / 1000);
            
            await expect(
                oracleAdapter.connect(updater2).updatePrice(ETH_ADDRESS, price, timestamp)
            ).to.be.revertedWithCustomError(oracleAdapter, "UnauthorizedUpdater");
        });
        
        it("Should maintain price history correctly", async function () {
            const prices = [
                ethers.parseEther("3000"),
                ethers.parseEther("3100"),
                ethers.parseEther("3200")
            ];
            const timestamps = [
                Math.floor(Date.now() / 1000),
                Math.floor(Date.now() / 1000) + 60,
                Math.floor(Date.now() / 1000) + 120
            ];
            
            for (let i = 0; i < prices.length; i++) {
                await oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, prices[i], timestamps[i]);
            }
            
            const [storedPrices, storedTimestamps] = await oracleAdapter.getPriceHistory(ETH_ADDRESS);
            expect(storedPrices.length).to.equal(prices.length);
            expect(storedTimestamps.length).to.equal(timestamps.length);
            
            for (let i = 0; i < prices.length; i++) {
                expect(storedPrices[i]).to.equal(prices[i]);
                expect(storedTimestamps[i]).to.equal(timestamps[i]);
            }
        });
        
        it("Should limit price history to 100 entries", async function () {
            const basePrice = ethers.parseEther("3000");
            const baseTimestamp = Math.floor(Date.now() / 1000);
            
            // Add 101 prices
            for (let i = 0; i < 101; i++) {
                await oracleAdapter.connect(updater1).updatePrice(
                    ETH_ADDRESS,
                    basePrice + BigInt(i),
                    baseTimestamp + i
                );
            }
            
            const [prices, timestamps] = await oracleAdapter.getPriceHistory(ETH_ADDRESS);
            expect(prices.length).to.equal(100);
            expect(timestamps.length).to.equal(100);
            
            // Should keep the most recent 100
            expect(prices[prices.length - 1]).to.equal(basePrice + BigInt(100));
        });
    });
    
    describe("Price Retrieval", function () {
        beforeEach(async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
            
            // Add some price data
            const prices = [
                ethers.parseEther("3000"),
                ethers.parseEther("3100"),
                ethers.parseEther("3200")
            ];
            const timestamps = [
                Math.floor(Date.now() / 1000),
                Math.floor(Date.now() / 1000) + 60,
                Math.floor(Date.now() / 1000) + 120
            ];
            
            for (let i = 0; i < prices.length; i++) {
                await oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, prices[i], timestamps[i]);
            }
        });
        
        it("Should get latest price correctly", async function () {
            const priceData = await oracleAdapter.getLatestPrice(ETH_ADDRESS);
            
            expect(priceData.price).to.equal(ethers.parseEther("3200"));
            expect(priceData.isValid).to.be.true;
        });
        
        it("Should revert when no price data exists", async function () {
            await expect(
                oracleAdapter.getLatestPrice(USDC_ADDRESS)
            ).to.be.revertedWithCustomError(oracleAdapter, "PriceDataNotFound");
        });
        
        it("Should get price at specific timestamp", async function () {
            const targetTimestamp = Math.floor(Date.now() / 1000) + 60;
            const price = await oracleAdapter.getPriceAt(ETH_ADDRESS, targetTimestamp);
            
            expect(price).to.equal(ethers.parseEther("3100"));
        });
        
        it("Should revert when getting price for non-existent asset", async function () {
            const timestamp = Math.floor(Date.now() / 1000);
            
            await expect(
                oracleAdapter.getPriceAt(USDC_ADDRESS, timestamp)
            ).to.be.revertedWithCustomError(oracleAdapter, "PriceDataNotFound");
        });
    });
    
    describe("Volatility Configuration", function () {
        it("Should set volatility config successfully", async function () {
            const config = {
                baseSpacing: ethers.parseEther("50"),
                volatilityMultiplier: 100,
                minSpacing: ethers.parseEther("10"),
                maxSpacing: ethers.parseEther("200")
            };
            
            const tx = await oracleAdapter.setVolatilityConfig(ETH_ADDRESS, config);
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "VolatilityConfigUpdated"
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.asset).to.equal(ETH_ADDRESS);
            expect(event.args.baseSpacing).to.equal(config.baseSpacing);
            expect(event.args.volatilityMultiplier).to.equal(config.volatilityMultiplier);
        });
        
        it("Should revert with invalid config", async function () {
            const invalidConfig = {
                baseSpacing: 0, // Invalid
                volatilityMultiplier: 100,
                minSpacing: ethers.parseEther("10"),
                maxSpacing: ethers.parseEther("200")
            };
            
            await expect(
                oracleAdapter.setVolatilityConfig(ETH_ADDRESS, invalidConfig)
            ).to.be.revertedWithCustomError(oracleAdapter, "InvalidVolatilityConfig");
        });
        
        it("Should revert when min spacing >= max spacing", async function () {
            const invalidConfig = {
                baseSpacing: ethers.parseEther("50"),
                volatilityMultiplier: 100,
                minSpacing: ethers.parseEther("200"), // >= maxSpacing
                maxSpacing: ethers.parseEther("200")
            };
            
            await expect(
                oracleAdapter.setVolatilityConfig(ETH_ADDRESS, invalidConfig)
            ).to.be.revertedWithCustomError(oracleAdapter, "InvalidVolatilityConfig");
        });
        
        it("Should get volatility config correctly", async function () {
            const config = {
                baseSpacing: ethers.parseEther("50"),
                volatilityMultiplier: 100,
                minSpacing: ethers.parseEther("10"),
                maxSpacing: ethers.parseEther("200")
            };
            
            await oracleAdapter.setVolatilityConfig(ETH_ADDRESS, config);
            
            const retrievedConfig = await oracleAdapter.getVolatilityConfig(ETH_ADDRESS);
            expect(retrievedConfig.baseSpacing).to.equal(config.baseSpacing);
            expect(retrievedConfig.volatilityMultiplier).to.equal(config.volatilityMultiplier);
            expect(retrievedConfig.minSpacing).to.equal(config.minSpacing);
            expect(retrievedConfig.maxSpacing).to.equal(config.maxSpacing);
        });
        
        it("Should revert when getting non-existent config", async function () {
            await expect(
                oracleAdapter.getVolatilityConfig(USDC_ADDRESS)
            ).to.be.revertedWithCustomError(oracleAdapter, "VolatilityConfigNotFound");
        });
    });
    
    describe("Volatility Calculation", function () {
        beforeEach(async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
            
            // Set volatility config
            const config = {
                baseSpacing: ethers.parseEther("50"),
                volatilityMultiplier: 100,
                minSpacing: ethers.parseEther("10"),
                maxSpacing: ethers.parseEther("200")
            };
            await oracleAdapter.setVolatilityConfig(ETH_ADDRESS, config);
            
            // Add price data for volatility calculation
            const prices = [
                ethers.parseEther("3000"),
                ethers.parseEther("3100"),
                ethers.parseEther("3200"),
                ethers.parseEther("3150"),
                ethers.parseEther("3250")
            ];
            const timestamps = [
                Math.floor(Date.now() / 1000),
                Math.floor(Date.now() / 1000) + 60,
                Math.floor(Date.now() / 1000) + 120,
                Math.floor(Date.now() / 1000) + 180,
                Math.floor(Date.now() / 1000) + 240
            ];
            
            for (let i = 0; i < prices.length; i++) {
                await oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, prices[i], timestamps[i]);
            }
        });
        
        it("Should calculate volatility correctly", async function () {
            const volatility = await oracleAdapter.getVolatility(ETH_ADDRESS, 3600); // 1 hour
            
            expect(volatility).to.be.gt(0);
            expect(volatility).to.be.lte(1000); // Max volatility
        });
        
        it("Should revert with insufficient price history", async function () {
            await expect(
                oracleAdapter.getVolatility(USDC_ADDRESS, 3600)
            ).to.be.revertedWithCustomError(oracleAdapter, "InsufficientPriceHistory");
        });
        
        it("Should calculate dynamic spacing correctly", async function () {
            const baseSpacing = ethers.parseEther("50");
            const dynamicSpacing = await oracleAdapter.calculateDynamicSpacing(ETH_ADDRESS, baseSpacing);
            
            expect(dynamicSpacing).to.be.gte(ethers.parseEther("10")); // Min spacing
            expect(dynamicSpacing).to.be.lte(ethers.parseEther("200")); // Max spacing
        });
        
        it("Should revert when no volatility config exists", async function () {
            await expect(
                oracleAdapter.calculateDynamicSpacing(USDC_ADDRESS, ethers.parseEther("50"))
            ).to.be.revertedWithCustomError(oracleAdapter, "VolatilityConfigNotFound");
        });
    });
    
    describe("Price Staleness", function () {
        beforeEach(async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
            
            const price = ethers.parseEther("3000");
            const timestamp = Math.floor(Date.now() / 1000);
            await oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, price, timestamp);
        });
        
        it("Should detect stale prices", async function () {
            const maxAge = 3600; // 1 hour
            const isStale = await oracleAdapter.isPriceStale(ETH_ADDRESS, maxAge);
            
            // Should not be stale immediately after update
            expect(isStale).to.be.false;
        });
        
        it("Should return true for non-existent asset", async function () {
            const maxAge = 3600;
            const isStale = await oracleAdapter.isPriceStale(USDC_ADDRESS, maxAge);
            
            expect(isStale).to.be.true;
        });
    });
    
    describe("Price Change Percentage", function () {
        beforeEach(async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
            
            // Add price data with clear trend
            const prices = [
                ethers.parseEther("3000"),
                ethers.parseEther("3100"),
                ethers.parseEther("3200")
            ];
            const timestamps = [
                Math.floor(Date.now() / 1000),
                Math.floor(Date.now() / 1000) + 60,
                Math.floor(Date.now() / 1000) + 120
            ];
            
            for (let i = 0; i < prices.length; i++) {
                await oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, prices[i], timestamps[i]);
            }
        });
        
        it("Should calculate price change percentage correctly", async function () {
            const timeframe = 180; // 3 minutes
            const changePercent = await oracleAdapter.getPriceChangePercent(ETH_ADDRESS, timeframe);
            
            // Should be positive (price increased from 3000 to 3200)
            expect(changePercent).to.be.gt(0);
        });
        
        it("Should revert with insufficient price history", async function () {
            await expect(
                oracleAdapter.getPriceChangePercent(USDC_ADDRESS, 3600)
            ).to.be.revertedWithCustomError(oracleAdapter, "InsufficientPriceHistory");
        });
    });
    
    describe("Price History Management", function () {
        beforeEach(async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
        });
        
        it("Should clear price history", async function () {
            // Add some price data
            const price = ethers.parseEther("3000");
            const timestamp = Math.floor(Date.now() / 1000);
            await oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, price, timestamp);
            
            // Clear history
            await oracleAdapter.clearPriceHistory(ETH_ADDRESS);
            
            // Should revert when trying to get latest price
            await expect(
                oracleAdapter.getLatestPrice(ETH_ADDRESS)
            ).to.be.revertedWithCustomError(oracleAdapter, "PriceDataNotFound");
        });
        
        it("Should only allow owner to clear price history", async function () {
            await expect(
                oracleAdapter.connect(user1).clearPriceHistory(ETH_ADDRESS)
            ).to.be.revertedWithCustomError(oracleAdapter, "OwnableUnauthorizedAccount");
        });
    });
    
    describe("Pausable", function () {
        it("Should pause and unpause correctly", async function () {
            await oracleAdapter.pause();
            expect(await oracleAdapter.paused()).to.be.true;
            
            await oracleAdapter.unpause();
            expect(await oracleAdapter.paused()).to.be.false;
        });
        
        it("Should only allow owner to pause", async function () {
            await expect(
                oracleAdapter.connect(user1).pause()
            ).to.be.revertedWithCustomError(oracleAdapter, "OwnableUnauthorizedAccount");
        });
        
        it("Should only allow owner to unpause", async function () {
            await oracleAdapter.pause();
            await expect(
                oracleAdapter.connect(user1).unpause()
            ).to.be.revertedWithCustomError(oracleAdapter, "OwnableUnauthorizedAccount");
        });
    });
    
    describe("Edge Cases", function () {
        it("Should handle zero price correctly", async function () {
            await expect(
                oracleAdapter.getLatestPrice(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(oracleAdapter, "ZeroAddress");
        });
        
        it("Should handle invalid timestamps correctly", async function () {
            await expect(
                oracleAdapter.getPriceAt(ETH_ADDRESS, 0)
            ).to.be.revertedWithCustomError(oracleAdapter, "InvalidTimestamp");
        });
        
        it("Should handle volatility bounds correctly", async function () {
            await oracleAdapter.authorizeUpdater(updater1.address);
            
            // Add price data with extreme volatility
            const prices = [
                ethers.parseEther("1000"),
                ethers.parseEther("2000"),
                ethers.parseEther("1000"),
                ethers.parseEther("2000")
            ];
            const timestamps = [
                Math.floor(Date.now() / 1000),
                Math.floor(Date.now() / 1000) + 60,
                Math.floor(Date.now() / 1000) + 120,
                Math.floor(Date.now() / 1000) + 180
            ];
            
            for (let i = 0; i < prices.length; i++) {
                await oracleAdapter.connect(updater1).updatePrice(ETH_ADDRESS, prices[i], timestamps[i]);
            }
            
            const volatility = await oracleAdapter.getVolatility(ETH_ADDRESS, 3600);
            expect(volatility).to.be.gte(1); // Min volatility
            expect(volatility).to.be.lte(1000); // Max volatility
        });
    });
}); 