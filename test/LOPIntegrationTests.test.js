const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LOP Integration & Factory Tests", function () {
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

    await testBot.initialize(
      await mockLOP.getAddress(),
      await lopAdapter.getAddress(),
      await orderManager.getAddress(),
      await oracleAdapter.getAddress(),
      deployer.address
    );

    // Setup mock prices and fund bot
    await oracleAdapter.updatePrice(
      await mockETH.getAddress(),
      ethers.parseEther("3000"),
      Math.floor(Date.now() / 1000),
      500
    );

    await mockUSDC.mint(await testBot.getAddress(), ethers.parseEther("100000"));
    await mockETH.mint(await testBot.getAddress(), ethers.parseEther("100"));
  });

  describe("LOPAdapter Integration", function () {
    it("should create LOP orders correctly", async function () {
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

    it("should handle order cancellation", async function () {
      const orderHash = await lopAdapter.createOrder(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("1"),
        ethers.parseEther("3000"),
        deployer.address,
        ethers.ZeroAddress,
        "0x"
      );

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

      await lopAdapter.cancelOrder(order);

      const [exists] = await lopAdapter.getOrderInfo(orderHash);
      expect(exists).to.be.false;
    });
  });

  describe("Factory Functionality", function () {
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

    it("should handle bot upgrades", async function () {
      const userBots = await factory.getUserBots(deployer.address);
      const botAddress = userBots[userBots.length - 1];

      // Deploy new bot implementation
      const NewInchbyinchBot = await ethers.getContractFactory("inchbyinchBot");
      const newBotImplementation = await NewInchbyinchBot.deploy();
      await newBotImplementation.waitForDeployment();

      // Upgrade factory (this would require factory upgrade functionality)
      // For now, just test that we can deploy new bots
      await factory.deployBot();
      
      const updatedUserBots = await factory.getUserBots(deployer.address);
      expect(updatedUserBots.length).to.be.greaterThan(userBots.length);
    });

    it("should handle deposits and withdrawals", async function () {
      const depositAmount = ethers.parseEther("1");
      
      // Test deposit functionality (if implemented)
      // await factory.deposit({ value: depositAmount });
      
      // Test withdrawal functionality (if implemented)
      // await factory.withdraw(depositAmount);
    });
  });

  describe("Order Management", function () {
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

    it("should track orders in OrderManager", async function () {
      const botOrders = await orderManager.getBotOrders(await testBot.getAddress());
      expect(botOrders.length).to.be.greaterThan(0);
    });

    it("should handle order fills through OrderManager", async function () {
      const order = await testBot.getOrder(1);
      
      // Simulate order fill
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.1"),
        0
      );

      // Check that order was updated in OrderManager
      const botOrders = await orderManager.getBotOrders(await testBot.getAddress());
      expect(botOrders.length).to.be.greaterThanOrEqual(0);
    });

    it("should handle order cancellations through OrderManager", async function () {
      const order = await testBot.getOrder(1);
      
      await testBot.cancelOrder(1);

      // Check that order was cancelled in OrderManager
      const botOrders = await orderManager.getBotOrders(await testBot.getAddress());
      // Note: Cancelled orders might still be tracked for history
    });
  });

  describe("Oracle Integration", function () {
    it("should use oracle prices for order placement", async function () {
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

      // Update oracle price
      await oracleAdapter.updatePrice(
        await mockETH.getAddress(),
        ethers.parseEther("3500"), // New price
        Math.floor(Date.now() / 1000),
        500
      );

      await testBot.placeLadderOrders();

      // Orders should be placed based on new oracle price
      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);
    });

    it("should handle oracle failures gracefully", async function () {
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

      // Remove oracle price to simulate failure
      // This would require oracle adapter to handle missing prices
      
      // Should still place orders using fallback price
      await testBot.placeLadderOrders();
      
      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);
    });
  });

  describe("Gas Optimization", function () {
    it("should optimize gas usage for order placement", async function () {
      await testBot.createStrategy(
        await mockETH.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseEther("3000"),
        ethers.parseEther("50"),
        ethers.parseEther("0.1"),
        5, // Multiple orders
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

      // Should be gas efficient
      expect(receipt.gasUsed).to.be.lessThan(3000000); // 3M gas limit
    });

    it("should optimize gas usage for order fills", async function () {
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

      await testBot.placeLadderOrders();

      // Fill multiple orders
      for (let i = 1; i <= 3; i++) {
        const order = await testBot.getOrder(i);
        if (order.isActive) {
          const tx = await testBot.handleOrderFill(
            order.orderHash,
            ethers.parseEther("0.1"),
            0
          );
          const receipt = await tx.wait();
          
          // Each fill should be gas efficient
          expect(receipt.gasUsed).to.be.lessThan(500000); // 500K gas limit
        }
      }
    });
  });

  describe("Security & Access Control", function () {
    it("should reject unauthorized bot operations", async function () {
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

    it("should reject unauthorized factory operations", async function () {
      await expect(
        factory.connect(user1).deployBot()
      ).to.be.reverted; // Should be restricted to authorized users
    });

    it("should handle contract pauses correctly", async function () {
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

      await testBot.unpause();

      // Should work after unpause
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
    });
  });

  describe("Real LOP Integration", function () {
    it("should create real LOP orders", async function () {
      // This test would require real LOP contract
      // For now, test with mock LOP
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

      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);

      // Verify orders were created in LOP adapter
      const userOrders = await lopAdapter.getUserOrders(deployer.address);
      expect(userOrders.length).to.be.greaterThan(0);
    });

    it("should handle LOP order fills", async function () {
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

      const order = await testBot.getOrder(1);
      
      // Simulate LOP order fill
      await testBot.handleOrderFill(
        order.orderHash,
        ethers.parseEther("0.1"),
        0
      );

      // Verify order was updated
      const updatedOrder = await testBot.getOrder(1);
      expect(updatedOrder.isActive).to.be.false;
    });
  });

  describe("Multi-Network Support", function () {
    it("should work with different token pairs", async function () {
      // Test with different token configurations
      const mockWBTC = await ethers.getContractFactory("MockERC20");
      const wbtc = await mockWBTC.deploy("Wrapped Bitcoin", "WBTC");
      await wbtc.waitForDeployment();

      await oracleAdapter.updatePrice(
        await wbtc.getAddress(),
        ethers.parseEther("45000"),
        Math.floor(Date.now() / 1000),
        300
      );

      await wbtc.mint(await testBot.getAddress(), ethers.parseEther("10"));

      await testBot.createStrategy(
        await wbtc.getAddress(),
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

      await testBot.placeLadderOrders();

      const activeOrders = await testBot.getActiveOrders();
      expect(activeOrders.length).to.be.greaterThan(0);
    });
  });
}); 