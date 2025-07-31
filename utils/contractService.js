import { parseEther, formatEther } from 'viem';
import {
  createFactoryContract,
  createOrderManagerContract,
  createOracleAdapterContract,
  createBotContract,
  getNetworkConfig,
  validateContractAddresses,
  formatTokenAmount,
  parseTokenAmount,
  getTokenConfig
} from './contracts';

class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.networkConfig = null;
    this.factory = null;
    this.orderManager = null;
    this.oracleAdapter = null;
    this.userBots = new Map();
  }

  // Initialize the service
  async initialize(publicClient, walletClient) {
    if (!publicClient || !walletClient) {
      throw new Error('Public client and wallet client are required');
    }

    this.publicClient = publicClient;
    this.walletClient = walletClient;

    // Get current network
    const chainId = await publicClient.getChainId();
    this.networkConfig = getNetworkConfig(chainId);

    // Validate contract addresses
    validateContractAddresses(this.networkConfig);

    // Initialize contracts with wallet client
    this.factory = createFactoryContract(walletClient, this.networkConfig);
    this.orderManager = createOrderManagerContract(walletClient, this.networkConfig);
    this.oracleAdapter = createOracleAdapterContract(walletClient, this.networkConfig);

    console.log('ContractService initialized for network:', this.networkConfig.name);
  }

  // Get current network info
  getNetworkInfo() {
    return this.networkConfig;
  }

  // Deploy a new bot
  async deployBot(userAddress) {
    try {
      console.log('Deploying bot for user:', userAddress);

      // Get deployment cost
      const deploymentCost = parseEther('0.01');

      // Deploy bot using Viem
      const { request } = await this.publicClient.simulateContract({
        address: this.factory.address,
        abi: this.factory.abi,
        functionName: 'deployBot',
        args: [userAddress],
        value: deploymentCost,
        account: userAddress
      });

      const hash = await this.walletClient.writeContract(request);
      console.log('Bot deployment transaction:', hash);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Bot deployed successfully:', receipt);

      // Get bot address from event
      const event = receipt.logs.find(log => 
        log.topics[0] === '0x...' // BotDeployed event signature
      );

      if (!event) {
        throw new Error('BotDeployed event not found');
      }

      const botAddress = event.address; // Extract from event
      console.log('Bot deployed at:', botAddress);

      // Store bot instance
      this.userBots.set(botAddress, createBotContract(botAddress, this.walletClient));

      return {
        botAddress,
        txHash: hash,
        deploymentCost: deploymentCost.toString()
      };

    } catch (error) {
      console.error('Error deploying bot:', error);
      throw new Error(`Failed to deploy bot: ${error.message}`);
    }
  }

  // Create a strategy on a bot
  async createStrategy(botAddress, strategyConfig) {
    try {
      console.log('Creating strategy on bot:', botAddress);

      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.signer);
      
      // Parse strategy parameters
      const {
        makerAsset,
        takerAsset,
        startPrice,
        spacing,
        orderSize,
        numOrders,
        strategyType,
        repostMode,
        budget,
        stopLoss,
        takeProfit,
        expiryTime,
        flipToSell,
        flipPercentage
      } = strategyConfig;

      // Convert prices to wei
      const startPriceWei = parseTokenAmount(startPrice, 18);
      const spacingWei = parseTokenAmount(spacing, 18);
      const orderSizeWei = parseTokenAmount(orderSize, 18);
      const budgetWei = parseTokenAmount(budget, 18);
      const stopLossWei = stopLoss > 0 ? parseTokenAmount(stopLoss, 18) : 0;
      const takeProfitWei = takeProfit > 0 ? parseTokenAmount(takeProfit, 18) : 0;

      // Calculate expiry time
      const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryTime * 3600); // hours to seconds

      // Estimate gas
      const gasEstimate = await estimateGasWithBuffer(
        bot,
        'createStrategy',
        [
          makerAsset,
          takerAsset,
          startPriceWei,
          spacingWei,
          orderSizeWei,
          numOrders,
          strategyType,
          repostMode,
          budgetWei,
          stopLossWei,
          takeProfitWei,
          expiryTimestamp,
          flipToSell,
          flipPercentage
        ],
        1.3
      );

      // Create strategy
      const tx = await bot.createStrategy(
        makerAsset,
        takerAsset,
        startPriceWei,
        spacingWei,
        orderSizeWei,
        numOrders,
        strategyType,
        repostMode,
        budgetWei,
        stopLossWei,
        takeProfitWei,
        expiryTimestamp,
        flipToSell,
        flipPercentage,
        { gasLimit: gasEstimate }
      );

      console.log('Strategy creation transaction:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Strategy created successfully:', receipt);

      return {
        txHash: tx.hash,
        strategyId: receipt.logs[0]?.topics[1] // Extract strategy ID from event
      };

    } catch (error) {
      console.error('Error creating strategy:', error);
      throw new Error(`Failed to create strategy: ${error.message}`);
    }
  }

  // Place ladder orders
  async placeLadderOrders(botAddress) {
    try {
      console.log('Placing ladder orders on bot:', botAddress);

      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.signer);

      // Estimate gas
      const gasEstimate = await estimateGasWithBuffer(
        bot,
        'placeLadderOrders',
        [],
        1.5
      );

      // Place orders
      const tx = await bot.placeLadderOrders({ gasLimit: gasEstimate });

      console.log('Order placement transaction:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Orders placed successfully:', receipt);

      return {
        txHash: tx.hash,
        orderCount: receipt.logs.filter(log => {
          try {
            const parsed = bot.interface.parseLog(log);
            return parsed.name === 'OrderPlaced';
          } catch {
            return false;
          }
        }).length
      };

    } catch (error) {
      console.error('Error placing orders:', error);
      throw new Error(`Failed to place orders: ${error.message}`);
    }
  }

  // Get user's bots
  async getUserBots(userAddress) {
    try {
      const botAddresses = await this.factory.getUserBots(userAddress);
      
      // Create bot instances for each address
      const bots = [];
      for (const botAddress of botAddresses) {
        if (botAddress !== ethers.ZeroAddress) {
          const bot = createBotContract(botAddress, this.signer);
          this.userBots.set(botAddress, bot);
          bots.push({
            address: botAddress,
            instance: bot
          });
        }
      }

      return bots;

    } catch (error) {
      console.error('Error getting user bots:', error);
      throw new Error(`Failed to get user bots: ${error.message}`);
    }
  }

  // Get bot strategy
  async getBotStrategy(botAddress) {
    try {
      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.signer);
      const strategy = await bot.strategy();
      
      return {
        makerAsset: strategy.makerAsset,
        takerAsset: strategy.takerAsset,
        startPrice: formatTokenAmount(strategy.startPrice, 18),
        spacing: formatTokenAmount(strategy.spacing, 18),
        orderSize: formatTokenAmount(strategy.orderSize, 18),
        numOrders: strategy.numOrders.toString(),
        strategyType: strategy.strategyType.toString(),
        repostMode: strategy.repostMode.toString(),
        budget: formatTokenAmount(strategy.budget, 18),
        stopLoss: strategy.stopLoss > 0 ? formatTokenAmount(strategy.stopLoss, 18) : '0',
        takeProfit: strategy.takeProfit > 0 ? formatTokenAmount(strategy.takeProfit, 18) : '0',
        expiryTime: new Date(strategy.expiryTime * 1000).toISOString(),
        isActive: strategy.isActive,
        currentOrderIndex: strategy.currentOrderIndex.toString(),
        totalFilled: formatTokenAmount(strategy.totalFilled, 18),
        totalSpent: formatTokenAmount(strategy.totalSpent, 18),
        flipToSell: strategy.flipToSell,
        flipPercentage: strategy.flipPercentage.toString(),
        flipSellActive: strategy.flipSellActive
      };

    } catch (error) {
      console.error('Error getting bot strategy:', error);
      throw new Error(`Failed to get bot strategy: ${error.message}`);
    }
  }

  // Get bot orders
  async getBotOrders(botAddress) {
    try {
      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.signer);
      
      // Get active order indices
      const activeOrderIndices = await bot.getActiveOrders();
      
      const orders = [];
      for (const orderIndex of activeOrderIndices) {
        if (orderIndex > 0) {
          const order = await bot.getOrder(orderIndex);
          orders.push({
            index: orderIndex.toString(),
            hash: order.orderHash,
            price: formatTokenAmount(order.price, 18),
            isActive: order.isActive,
            createdAt: new Date(order.createdAt * 1000).toISOString()
          });
        }
      }

      return orders;

    } catch (error) {
      console.error('Error getting bot orders:', error);
      throw new Error(`Failed to get bot orders: ${error.message}`);
    }
  }

  // Cancel all orders
  async cancelAllOrders(botAddress) {
    try {
      console.log('Cancelling all orders on bot:', botAddress);

      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.signer);

      // Estimate gas
      const gasEstimate = await estimateGasWithBuffer(
        bot,
        'cancelAllOrders',
        [],
        1.3
      );

      // Cancel orders
      const tx = await bot.cancelAllOrders({ gasLimit: gasEstimate });

      console.log('Order cancellation transaction:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Orders cancelled successfully:', receipt);

      return {
        txHash: tx.hash
      };

    } catch (error) {
      console.error('Error cancelling orders:', error);
      throw new Error(`Failed to cancel orders: ${error.message}`);
    }
  }

  // Get strategy performance
  async getStrategyPerformance(botAddress) {
    try {
      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.signer);
      const [totalFilled, totalSpent, profit] = await bot.getStrategyPerformance();
      
      return {
        totalFilled: formatTokenAmount(totalFilled, 18),
        totalSpent: formatTokenAmount(totalSpent, 18),
        profit: formatTokenAmount(profit, 18),
        profitPercentage: totalSpent > 0 ? ((profit / totalSpent) * 100).toFixed(2) : '0'
      };

    } catch (error) {
      console.error('Error getting strategy performance:', error);
      throw new Error(`Failed to get strategy performance: ${error.message}`);
    }
  }

  // Get token balance
  async getTokenBalance(tokenAddress, userAddress) {
    try {
      const token = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        this.provider
      );

      const [balance, decimals] = await Promise.all([
        token.balanceOf(userAddress),
        token.decimals()
      ]);

      return formatTokenAmount(balance, decimals);

    } catch (error) {
      console.error('Error getting token balance:', error);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

  // Get current price from oracle
  async getCurrentPrice(tokenAddress) {
    try {
      const priceData = await this.oracleAdapter.getLatestPrice(tokenAddress);
      return formatTokenAmount(priceData.price, 18);

    } catch (error) {
      console.error('Error getting current price:', error);
      throw new Error(`Failed to get current price: ${error.message}`);
    }
  }

  // Check if network is supported
  isNetworkSupported(chainId) {
    return chainId === 11155111; // Sepolia only
  }

  // Get supported networks
  getSupportedNetworks() {
    return [{ chainId: 11155111, name: 'Sepolia' }];
  }
}

// Create singleton instance
const contractService = new ContractService();

export default contractService; 