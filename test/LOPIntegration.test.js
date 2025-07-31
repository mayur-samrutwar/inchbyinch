const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LOP Integration", function () {
  let deployer, user1, user2;
  let oracleAdapter, orderManager, lopAdapter, factory, botImplementation;
  let testBot;
  let mockLOP, mockUSDC, mockETH;

  const LOP_ADDRESS = "0x3ef51736315f52d568d6d2cf289419b9cfffe782";

  beforeEach(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploy mock contracts for testing
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
      await mockLOP.getAddress()
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

    it("should track user orders", async function () {
      await lopAdapter.createOrder(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("1"),
        ethers.parseEther("3000"),
        deployer.address,
        ethers.ZeroAddress,
        "0x"
      );

      const userOrders = await lopAdapter.getUserOrders(deployer.address);
      expect(userOrders.length).to.equal(1);
    });

    it("should validate orders", async function () {
      const orderHash = await lopAdapter.createOrder(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("1"),
        ethers.parseEther("3000"),
        deployer.address,
        ethers.ZeroAddress,
        "0x"
      );

      // Create order structure for validation
      const order = {
        salt: ethers.parseEther("1"),
        makerAsset: await mockETH.getAddress(),
        takerAsset: await mockUSDC.getAddress(),
        maker: await lopAdapter.getAddress(),
        receiver: deployer.address,
        allowedSender: ethers.ZeroAddress,
        makingAmount: ethers.parseEther("1"),
        takingAmount: ethers.parseEther("3000"),
        offsets: 0,
        interactions: "0x"
      };

      const isValid = await lopAdapter.checkOrder(order);
      expect(isValid).to.be.true;
    });
  });

  describe("Bot LOP Integration", function () {
    it("should create strategy and place orders", async function () {
      // Create strategy
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

      // Place ladder orders
      await testBot.placeLadderOrders();

      // Check that orders were created
      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);
    });

    it("should handle order fills correctly", async function () {
      // Create strategy
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

      // Place orders
      await testBot.placeLadderOrders();

      // Get first order
      const order = await testBot.getOrder(1);
      expect(order.isActive).to.be.true;

      // Simulate order fill
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.05"),
        ethers.parseEther("0.05")
      );

      // Check that order was updated
      const updatedOrder = await testBot.getOrder(1);
      expect(updatedOrder.isActive).to.be.false;
    });

    it("should handle sell-flip chaining", async function () {
      // Create strategy with flip enabled
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
        true,  // flipToSell
        10     // flipPercentage
      );

      // Place orders
      await testBot.placeLadderOrders();

      // Get first order
      const order = await testBot.getOrder(1);

      // Simulate complete fill (remainingAmount = 0)
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.1"),
        0 // Complete fill
      );

      // Check that a sell order was created
      const allOrders = await testBot.getActiveOrders();
      expect(allOrders.length).to.be.greaterThan(0);
    });

    it("should cancel orders correctly", async function () {
      // Create strategy
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

      // Place orders
      await testBot.placeLadderOrders();

      // Cancel all orders
      await testBot.cancelAllOrders();

      // Check that no orders are active
      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.equal(0);
    });
  });

  describe("Factory Integration", function () {
    it("should deploy bots correctly", async function () {
      const userBots = await factory.getUserBots(deployer.address);
      expect(userBots.length).to.be.greaterThan(0);

      const botCount = await factory.botDeploymentCount(deployer.address);
      expect(botCount).to.be.greaterThan(0);
    });

    it("should track user limits", async function () {
      // Deploy multiple bots
      for (let i = 0; i < 3; i++) {
        await factory.deployBot();
      }

      const userBots = await factory.getUserBots(deployer.address);
      expect(userBots.length).to.be.lessThanOrEqual(10); // MAX_BOTS_PER_USER
    });
  });

  describe("Order Management", function () {
    it("should track orders correctly", async function () {
      // Create strategy and place orders
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

      // Check order manager
      const botOrders = await orderManager.getBotOrders(await testBot.getAddress());
      expect(botOrders.length).to.be.greaterThan(0);
    });
  });

  describe("Error Handling", function () {
    it("should reject invalid strategies", async function () {
      await expect(
        testBot.createStrategy(
          ethers.ZeroAddress,
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
    });

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
  });
}); 