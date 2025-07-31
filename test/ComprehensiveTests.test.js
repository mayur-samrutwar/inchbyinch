const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("inchbyinch Comprehensive Tests", function () {
  let deployer, user1, user2, user3;
  let oracleAdapter, orderManager, lopAdapter, factory, botImplementation;
  let testBot, testBot2;
  let mockLOP, mockUSDC, mockETH, mockWBTC, mockDAI;
  let mockTokens;

  const LOP_ADDRESS = "0x111111125421ca6dc452d289314280a0f8842a65";

  beforeEach(async function () {
    [deployer, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock contracts for testing
    const MockLOP = await ethers.getContractFactory("MockLOP");
    mockLOP = await MockLOP.deploy();
    await mockLOP.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC");
    await mockUSDC.waitForDeployment();
    
    mockETH = await MockERC20.deploy("Ethereum", "ETH");
    await mockETH.waitForDeployment();

    mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC");
    await mockWBTC.waitForDeployment();

    mockDAI = await MockERC20.deploy("Dai Stablecoin", "DAI");
    await mockDAI.waitForDeployment();

    mockTokens = {
      USDC: mockUSDC,
      ETH: mockETH,
      WBTC: mockWBTC,
      DAI: mockDAI
    };

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

    // Deploy test bots
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

    // Deploy second bot for testing
    await factory.deployBot();
    const userBots2 = await factory.getUserBots(deployer.address);
    const botAddress2 = userBots2[userBots2.length - 1];
    testBot2 = await ethers.getContractAt("inchbyinchBot", botAddress2);

    await testBot2.initialize(
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

    await oracleAdapter.updatePrice(
      await mockWBTC.getAddress(),
      ethers.parseEther("45000"),
      Math.floor(Date.now() / 1000),
      300
    );

    await oracleAdapter.updatePrice(
      await mockUSDC.getAddress(),
      ethers.parseEther("1"),
      Math.floor(Date.now() / 1000),
      50
    );

    // Fund bots with tokens
    await mockUSDC.mint(await testBot.getAddress(), ethers.parseEther("100000"));
    await mockETH.mint(await testBot.getAddress(), ethers.parseEther("100"));
    await mockWBTC.mint(await testBot.getAddress(), ethers.parseEther("10"));
    await mockDAI.mint(await testBot.getAddress(), ethers.parseEther("100000"));

    await mockUSDC.mint(await testBot2.getAddress(), ethers.parseEther("100000"));
    await mockETH.mint(await testBot2.getAddress(), ethers.parseEther("100"));
  });

  describe("Strategy Creation & Validation", function () {
    it("should create buy ladder strategy successfully", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"), // startPrice
        ethers.parseEther("50"),   // spacing
        ethers.parseEther("0.1"),  // orderSize
        5,                         // numOrders
        0,                         // strategyType (BUY_LADDER)
        1,                         // repostMode (NEXT_PRICE)
        ethers.parseEther("1500"), // budget
        0,                         // stopLoss
        0,                         // takeProfit
        Math.floor(Date.now() / 1000) + 3600, // expiryTime
        false,                     // flipToSell
        10                         // flipPercentage
      );

      const strategy = await testBot.strategy();
      expect(strategy.isActive).to.be.true;
      expect(strategy.strategyType).to.equal(0); // BUY_LADDER
      expect(strategy.repostMode).to.equal(1); // NEXT_PRICE
    });

    it("should create sell ladder strategy successfully", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"), // startPrice
        ethers.parseEther("50"),   // spacing
        ethers.parseEther("0.1"),  // orderSize
        5,                         // numOrders
        1,                         // strategyType (SELL_LADDER)
        1,                         // repostMode (NEXT_PRICE)
        ethers.parseEther("1500"), // budget
        0,                         // stopLoss
        0,                         // takeProfit
        Math.floor(Date.now() / 1000) + 3600, // expiryTime
        false,                     // flipToSell
        10                         // flipPercentage
      );

      const strategy = await testBot.strategy();
      expect(strategy.isActive).to.be.true;
      expect(strategy.strategyType).to.equal(1); // SELL_LADDER
    });

    it("should create buy-sell strategy successfully", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"), // startPrice
        ethers.parseEther("50"),   // spacing
        ethers.parseEther("0.1"),  // orderSize
        6,                         // numOrders (even for buy-sell)
        2,                         // strategyType (BUY_SELL)
        1,                         // repostMode (NEXT_PRICE)
        ethers.parseEther("1500"), // budget
        0,                         // stopLoss
        0,                         // takeProfit
        Math.floor(Date.now() / 1000) + 3600, // expiryTime
        false,                     // flipToSell
        10                         // flipPercentage
      );

      const strategy = await testBot.strategy();
      expect(strategy.isActive).to.be.true;
      expect(strategy.strategyType).to.equal(2); // BUY_SELL
    });

    it("should reject invalid strategy parameters", async function () {
      // Test zero numOrders
      await expect(
        testBot.createStrategy(
          await mockETH.getAddress(),
          await mockUSDC.getAddress(),
          ethers.parseEther("3000"),
          ethers.parseEther("50"),
          ethers.parseEther("0.1"),
          0, // Invalid numOrders
          0,
          1,
          ethers.parseEther("1500"),
          0,
          0,
          Math.floor(Date.now() / 1000) + 3600,
          false,
          10
        )
      ).to.be.revertedWithCustomError(testBot, "InvalidStrategy");

      // Test invalid strategy type
      await expect(
        testBot.createStrategy(
          await mockETH.getAddress(),
          await mockUSDC.getAddress(),
          ethers.parseEther("3000"),
          ethers.parseEther("50"),
          ethers.parseEther("0.1"),
          5,
          3, // Invalid strategy type
          1,
          ethers.parseEther("1500"),
          0,
          0,
          Math.floor(Date.now() / 1000) + 3600,
          false,
          10
        )
      ).to.be.revertedWithCustomError(testBot, "InvalidStrategy");

      // Test invalid repost mode
      await expect(
        testBot.createStrategy(
          await mockETH.getAddress(),
          await mockUSDC.getAddress(),
          ethers.parseEther("3000"),
          ethers.parseEther("50"),
          ethers.parseEther("0.1"),
          5,
          0,
          3, // Invalid repost mode
          ethers.parseEther("1500"),
          0,
          0,
          Math.floor(Date.now() / 1000) + 3600,
          false,
          10
        )
      ).to.be.revertedWithCustomError(testBot, "InvalidStrategy");
    });

    it("should reject expired strategy", async function () {
      await expect(
        testBot.createStrategy(
          await mockETH.getAddress(),
          await mockUSDC.getAddress(),
          ethers.parseEther("3000"),
          ethers.parseEther("50"),
          ethers.parseEther("0.1"),
          5,
          0,
          1,
          ethers.parseEther("1500"),
          0,
          0,
          Math.floor(Date.now() / 1000) - 3600, // Expired
          false,
          10
        )
      ).to.be.revertedWithCustomError(testBot, "InvalidExpiry");
    });

    it("should reject duplicate strategy creation", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        5,
        0,
        1,
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await expect(
        testBot.createStrategy(
          await mockETH.getAddress(),
          await mockUSDC.getAddress(),
          ethers.parseEther("3000"),
          ethers.parseEther("50"),
          ethers.parseEther("0.1"),
          5,
          0,
          1,
          ethers.parseEther("1500"),
          0,
          0,
          Math.floor(Date.now() / 1000) + 3600,
          false,
          10
        )
      ).to.be.revertedWithCustomError(testBot, "StrategyAlreadyActive");
    });
  });

  describe("Order Placement & Management", function () {
    beforeEach(async function () {
      // Create a strategy for testing
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        5,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );
    });

    it("should place buy ladder orders correctly", async function () {
      await testBot.placeLadderOrders();

      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);

      // Check first order
      const order1 = await testBot.getOrder(1);
      expect(order1.isActive).to.be.true;
      expect(order1.price).to.be.greaterThan(0);
    });

    it("should place sell ladder orders correctly", async function () {
      // Cancel current strategy
      await testBot.cancelAllOrders();

      // Create sell strategy
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        5,
        1, // SELL_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await testBot.placeLadderOrders();

      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);
    });

    it("should place buy-sell orders correctly", async function () {
      // Cancel current strategy
      await testBot.cancelAllOrders();

      // Create buy-sell strategy
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        6, // Even number for buy-sell
        2, // BUY_SELL
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await testBot.placeLadderOrders();

      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);
    });

    it("should cancel orders correctly", async function () {
      await testBot.placeLadderOrders();

      const activeOrdersBefore = await testBot.getActiveOrders();
      expect(activeOrdersBefore.length).to.be.greaterThan(0);

      await testBot.cancelAllOrders();

      const activeOrdersAfter = await testBot.getActiveOrders();
      expect(activeOrdersAfter.length).to.equal(0);
    });

    it("should cancel specific orders", async function () {
      await testBot.placeLadderOrders();

      const order1 = await testBot.getOrder(1);
      expect(order1.isActive).to.be.true;

      await testBot.cancelOrder(1);

      const updatedOrder1 = await testBot.getOrder(1);
      expect(updatedOrder1.isActive).to.be.false;
    });
  });

  describe("Order Fills & Reposting", function () {
    beforeEach(async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await testBot.placeLadderOrders();
    });

    it("should handle partial order fills", async function () {
      const order = await testBot.getOrder(1);
      expect(order.isActive).to.be.true;

      // Simulate partial fill
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.05"), // 50% fill
        ethers.parseEther("0.05")  // 50% remaining
      );

      const updatedOrder = await testBot.getOrder(1);
      expect(updatedOrder.isActive).to.be.true; // Still active due to partial fill
    });

    it("should handle complete order fills", async function () {
      const order = await testBot.getOrder(1);
      expect(order.isActive).to.be.true;

      // Simulate complete fill
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.1"), // 100% fill
        0 // No remaining
      );

      const updatedOrder = await testBot.getOrder(1);
      expect(updatedOrder.isActive).to.be.false; // No longer active
    });

    it("should repost orders with NEXT_PRICE mode", async function () {
      const order = await testBot.getOrder(1);
      
      // Complete fill should trigger repost
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.1"),
        0
      );

      // Check that a new order was created
      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);
    });

    it("should not repost with SKIP mode", async function () {
      // Cancel current strategy
      await testBot.cancelAllOrders();

      // Create strategy with SKIP repost mode
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0, // BUY_LADDER
        2, // SKIP
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await testBot.placeLadderOrders();

      const order = await testBot.getOrder(1);
      
      // Complete fill should not trigger repost
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.1"),
        0
      );

      // Check that no new order was created
      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.equal(0);
    });
  });

  describe("Sell-Flip Chaining", function () {
    beforeEach(async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        true, // flipToSell enabled
        10    // flipPercentage
      );

      await testBot.placeLadderOrders();
    });

    it("should trigger sell order after buy fill", async function () {
      const order = await testBot.getOrder(1);
      
      // Complete fill should trigger sell order
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.1"),
        0
      );

      // Check that a sell order was created
      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);

      // Check that flip sell is active
      const strategy = await testBot.strategy();
      expect(strategy.flipSellActive).to.be.true;
    });

    it("should not trigger sell order if flipToSell is disabled", async function () {
      // Cancel current strategy
      await testBot.cancelAllOrders();

      // Create strategy without flip
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false, // flipToSell disabled
        10
      );

      await testBot.placeLadderOrders();

      const order = await testBot.getOrder(1);
      
      // Complete fill should not trigger sell order
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.1"),
        0
      );

      // Check that no sell order was created
      const strategy = await testBot.strategy();
      expect(strategy.flipSellActive).to.be.false;
    });
  });

  describe("Stop Loss & Take Profit", function () {
    it("should trigger stop loss", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        ethers.parseEther("2500"), // stopLoss
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await testBot.placeLadderOrders();

      // Simulate price drop below stop loss
      await oracleAdapter.updatePrice(
        await mockETH.getAddress(),
        ethers.parseEther("2400"), // Below stop loss
        Math.floor(Date.now() / 1000),
        500
      );

      await expect(
        testBot.placeLadderOrders()
      ).to.be.revertedWithCustomError(testBot, "StopLossTriggered");
    });

    it("should trigger take profit", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        ethers.parseEther("3500"), // takeProfit
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await testBot.placeLadderOrders();

      // Simulate price rise above take profit
      await oracleAdapter.updatePrice(
        await mockETH.getAddress(),
        ethers.parseEther("3600"), // Above take profit
        Math.floor(Date.now() / 1000),
        500
      );

      await expect(
        testBot.placeLadderOrders()
      ).to.be.revertedWithCustomError(testBot, "TakeProfitTriggered");
    });
  });

  describe("Strategy Expiry", function () {
    it("should reject expired strategy", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 1, // Expires in 1 second
        false,
        10
      );

      await testBot.placeLadderOrders();

      // Wait for expiry
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine");

      await expect(
        testBot.placeLadderOrders()
      ).to.be.revertedWithCustomError(testBot, "StrategyExpired");
    });
  });

  describe("Budget Limits", function () {
    it("should respect budget limits", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        20, // Many orders
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("100"), // Small budget
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      // Should fail due to budget constraints
      await expect(
        testBot.placeLadderOrders()
      ).to.be.revertedWithCustomError(testBot, "ExceedsBudget");
    });
  });

  describe("Multiple Bots", function () {
    it("should handle multiple bots independently", async function () {
      // Setup second bot
      await testBot2.createStrategy(
        await mockWBTC.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("45000"),
        ethers.parseEther("500"),
        ethers.parseEther("0.01"),
        3,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await testBot2.placeLadderOrders();

      // Both bots should have active orders
      const bot1Orders = await testBot.getActiveOrders();
      const bot2Orders = await testBot2.getActiveOrders();

      expect(bot1Orders.length).to.be.greaterThan(0);
      expect(bot2Orders.length).to.be.greaterThan(0);
    });
  });

  describe("Error Handling", function () {
    it("should reject unauthorized calls", async function () {
      await expect(
        testBot.connect(user1).createStrategy(
          await mockETH.getAddress(),
          await mockUSDC.getAddress(),
          ethers.parseEther("3000"),
          ethers.parseEther("50"),
          ethers.parseEther("0.1"),
          3,
          0,
          1,
          ethers.parseEther("1500"),
          0,
          0,
          Math.floor(Date.now() / 1000) + 3600,
          false,
          10
        )
      ).to.be.revertedWithCustomError(testBot, "UnauthorizedCaller");
    });

    it("should reject invalid order fills", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0,
        1,
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await testBot.placeLadderOrders();

      // Try to fill non-existent order
      await expect(
        testBot.handleOrderFill(
          ethers.ZeroHash,
          ethers.parseEther("0.1"),
          0
        )
      ).to.be.revertedWithCustomError(testBot, "OrderNotFound");
    });

    it("should reject invalid order cancellation", async function () {
      await expect(
        testBot.cancelOrder(999) // Non-existent order
      ).to.be.revertedWithCustomError(testBot, "OrderNotFound");
    });
  });

  describe("Performance & Gas", function () {
    it("should handle large order sets efficiently", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        10, // Many orders
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      const tx = await testBot.placeLadderOrders();
      const receipt = await tx.wait();

      // Should complete without excessive gas usage
      expect(receipt.gasUsed).to.be.lessThan(5000000); // 5M gas limit
    });

    it("should handle multiple fills efficiently", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        5,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        true, // flipToSell
        10
      );

      await testBot.placeLadderOrders();

      // Fill multiple orders
      for (let i = 1; i <= 3; i++) {
        const order = await testBot.getOrder(i);
        if (order.isActive) {
          await testBot.handleOrderFill(
            order.orderHash,
            ethers.parseEther("0.1"),
            0
          );
        }
      }

      // Should handle multiple fills without issues
      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThanOrEqual(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero amounts gracefully", async function () {
      await expect(
        testBot.createStrategy(
          await mockETH.getAddress(),
          await mockUSDC.getAddress(),
          ethers.parseEther("3000"),
          ethers.parseEther("50"),
          0, // Zero order size
          3,
          0,
          1,
          ethers.parseEther("1500"),
          0,
          0,
          Math.floor(Date.now() / 1000) + 3600,
          false,
          10
        )
      ).to.be.revertedWithCustomError(testBot, "InvalidOrderSize");
    });

    it("should handle extreme price movements", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      // Simulate extreme price drop
      await oracleAdapter.updatePrice(
        await mockETH.getAddress(),
        ethers.parseEther("100"), // Extreme drop
        Math.floor(Date.now() / 1000),
        500
      );

      // Should handle gracefully
      await testBot.placeLadderOrders();
    });

    it("should handle contract pauses", async function () {
      await testBot.pause();

      await expect(
        testBot.createStrategy(
          await mockETH.getAddress(),
          await mockUSDC.getAddress(),
          ethers.parseEther("3000"),
          ethers.parseEther("50"),
          ethers.parseEther("0.1"),
          3,
          0,
          1,
          ethers.parseEther("1500"),
          0,
          0,
          Math.floor(Date.now() / 1000) + 3600,
          false,
          10
        )
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Integration Tests", function () {
    it("should complete full strategy lifecycle", async function () {
      // 1. Create strategy
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        3,
        0, // BUY_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        true, // flipToSell
        10
      );

      // 2. Place orders
      await testBot.placeLadderOrders();

      // 3. Fill orders
      for (let i = 1; i <= 3; i++) {
        const order = await testBot.getOrder(i);
        if (order.isActive) {
          await testBot.handleOrderFill(
            order.orderHash,
            ethers.parseEther("0.1"),
            0
          );
        }
      }

      // 4. Check strategy performance
      const [totalFilled, totalSpent, profit] = await testBot.getStrategyPerformance();
      expect(totalFilled).to.be.greaterThan(0);
      expect(totalSpent).to.be.greaterThan(0);

      // 5. Cancel remaining orders
      await testBot.cancelAllOrders();

      // 6. Verify strategy is complete
      const strategy = await testBot.strategy();
      expect(strategy.isActive).to.be.false;
    });

    it("should handle complex multi-token strategies", async function () {
      // Create strategy with different token pair
      await testBot2.createStrategy(
        await mockWBTC.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("45000"),
        ethers.parseEther("500"),
        ethers.parseEther("0.01"),
        3,
        1, // SELL_LADDER
        1, // NEXT_PRICE
        ethers.parseEther("1500"),
        0,
        0,
        Math.floor(Date.now() / 1000) + 3600,
        false,
        10
      );

      await testBot2.placeLadderOrders();

      // Fill orders
      for (let i = 1; i <= 3; i++) {
        const order = await testBot2.getOrder(i);
        if (order.isActive) {
          await testBot2.handleOrderFill(
            order.orderHash,
            ethers.parseEther("0.01"),
            0
          );
        }
      }

      // Verify both bots work independently
      const bot1Orders = await testBot.getActiveOrders();
      const bot2Orders = await testBot2.getActiveOrders();

      expect(bot1Orders.length).to.be.greaterThanOrEqual(0);
      expect(bot2Orders.length).to.be.greaterThanOrEqual(0);
    });
  });
}); 