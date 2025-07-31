import { createPublicClient, createWalletClient, http, getAddress } from 'viem';
import { getNetworkConfig, getContractAddressesForNetwork, CONTRACT_ABIS } from './contracts.js';
import { estimateGasWithBuffer } from './contracts.js';

class ContractService {
  constructor() {
    this.publicClient = null;
    this.walletClient = null;
    this.factory = null;
    this.userBots = new Map();
    this.currentNetwork = null;
  }

  // Initialize with network
  async initialize(chainId) {
    try {
      console.log('Initializing ContractService for chainId:', chainId);
      
      const networkConfig = getNetworkConfig(chainId);
      const contractAddresses = getContractAddressesForNetwork(chainId);
      
      console.log('Network config:', networkConfig);
      console.log('Contract addresses:', contractAddresses);
      
      // Create public client
      this.publicClient = createPublicClient({
        chain: networkConfig,
        transport: http(networkConfig.rpcUrl)
      });
      
      // Create wallet client (will be set when wallet connects)
      this.walletClient = null;
      
      // Set current network
      this.currentNetwork = networkConfig;
      
      // Initialize factory contract
      if (contractAddresses.factory) {
        this.factory = {
          address: contractAddresses.factory,
          abi: CONTRACT_ABIS.factory
        };
        console.log('Factory initialized:', this.factory.address);
      } else {
        console.warn('No factory address configured for this network');
        this.factory = null;
      }
      
      console.log('ContractService initialized successfully');
      
    } catch (error) {
      console.error('Error initializing ContractService:', error);
      throw error;
    }
  }

  // Set wallet client when wallet connects
  setWalletClient(walletClient) {
    this.walletClient = walletClient;
    console.log('Wallet client set');
  }

  // Get current network info
  getCurrentNetwork() {
    return this.currentNetwork;
  }

  // Check if service is ready
  isReady() {
    return this.publicClient && this.currentNetwork;
  }

  // Check if wallet is connected
  isWalletConnected() {
    return this.walletClient !== null;
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
      console.log('Getting bots for user:', userAddress);
      
      // Use Viem readContract pattern
      const botAddresses = await this.publicClient.readContract({
        address: this.factory.address,
        abi: this.factory.abi,
        functionName: 'getUserBots',
        args: [userAddress]
      });
      
      console.log('Raw bot addresses from factory:', botAddresses);
      
      // Create bot instances for each address
      const bots = [];
      for (const botAddress of botAddresses) {
        if (botAddress !== '0x0000000000000000000000000000000000000000') { // Zero address check
          try {
            // Check if contract exists
            const code = await this.publicClient.getBytecode({ address: botAddress });
            if (!code || code === '0x') {
              console.warn(`No contract found at bot address: ${botAddress}`);
              continue;
            }
            
            const bot = createBotContract(botAddress, this.walletClient);
            this.userBots.set(botAddress, bot);
            bots.push({
              address: botAddress,
              instance: bot
            });
            
            console.log(`Bot found: ${botAddress}`);
          } catch (botError) {
            console.error(`Error processing bot ${botAddress}:`, botError);
            // Continue with other bots
          }
        }
      }

      console.log(`Found ${bots.length} bots for user`);
      return bots;

    } catch (error) {
      console.error('Error getting user bots:', error);
      throw new Error(`Failed to get user bots: ${error.message}`);
    }
  }

  // Get bot strategy
  async getBotStrategy(botAddress) {
    try {
      console.log('Getting strategy for bot:', botAddress);
      
      // First check if the contract exists
      const code = await this.publicClient.getBytecode({ address: botAddress });
      if (!code || code === '0x') {
        console.warn(`No contract found at address ${botAddress}`);
        return this.getDefaultStrategy();
      }
      
      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.walletClient);
      
      // Try to get the strategy data - if it fails, return default
      const strategy = await this.publicClient.readContract({
        address: botAddress,
        abi: bot.abi,
        functionName: 'strategy'
      });
      
      console.log('Strategy retrieved successfully:', strategy);
      
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
      console.error(`Error getting bot strategy for ${botAddress}:`, error);
      console.log(`Returning default strategy for ${botAddress}`);
      return this.getDefaultStrategy();
    }
  }

  // Get default strategy for uninitialized bots
  getDefaultStrategy() {
    return {
      makerAsset: '0x0000000000000000000000000000000000000000',
      takerAsset: '0x0000000000000000000000000000000000000000',
      startPrice: '0',
      spacing: '0',
      orderSize: '0',
      numOrders: '0',
      strategyType: '0',
      repostMode: '0',
      budget: '0',
      stopLoss: '0',
      takeProfit: '0',
      expiryTime: new Date(0).toISOString(),
      isActive: false,
      currentOrderIndex: '0',
      totalFilled: '0',
      totalSpent: '0',
      flipToSell: false,
      flipPercentage: '0',
      flipSellActive: false
    };
  }

  // Get bot orders
  async getBotOrders(botAddress) {
    try {
      console.log('Getting orders for bot:', botAddress);
      
      // First check if the contract exists
      const code = await this.publicClient.getBytecode({ address: botAddress });
      if (!code || code === '0x') {
        console.warn(`No contract found at address ${botAddress}`);
        return [];
      }
      
      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.walletClient);
      
      // Get active order indices using Viem
      try {
        const activeOrderIndices = await this.publicClient.readContract({
          address: botAddress,
          abi: bot.abi,
          functionName: 'getActiveOrders'
        });
        
        console.log(`Found ${activeOrderIndices.length} active orders for bot ${botAddress}`);
        
        const orders = [];
        for (const orderIndex of activeOrderIndices) {
          if (orderIndex > 0) {
            try {
              // Get individual order using Viem
              const order = await this.publicClient.readContract({
                address: botAddress,
                abi: bot.abi,
                functionName: 'getOrder',
                args: [orderIndex]
              });
              
              orders.push({
                index: orderIndex.toString(),
                hash: order.orderHash,
                price: formatTokenAmount(order.price, 18),
                isActive: order.isActive,
                createdAt: new Date(order.createdAt * 1000).toISOString()
              });
            } catch (orderError) {
              console.error(`Error getting order ${orderIndex} for bot ${botAddress}:`, orderError);
              // Continue with other orders
            }
          }
        }

        return orders;
      } catch (ordersError) {
        console.error(`Error getting active orders for bot ${botAddress}:`, ordersError);
        return [];
      }

    } catch (error) {
      console.error('Error getting bot orders:', error);
      return [];
    }
  }

  // Cancel all orders
  async cancelAllOrders(botAddress) {
    try {
      console.log('Cancelling all orders on bot:', botAddress);

      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.walletClient);

      // Simulate the transaction first
      const { request } = await this.publicClient.simulateContract({
        address: botAddress,
        abi: bot.abi,
        functionName: 'cancelAllOrders',
        args: []
      });

      // Write the transaction
      const hash = await this.walletClient.writeContract(request);
      console.log('Order cancellation transaction:', hash);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Orders cancelled successfully:', receipt);

      return {
        txHash: hash
      };

    } catch (error) {
      console.error('Error cancelling orders:', error);
      throw new Error(`Failed to cancel orders: ${error.message}`);
    }
  }

  // Get strategy performance
  async getStrategyPerformance(botAddress) {
    try {
      console.log('Getting strategy performance for bot:', botAddress);
      
      // First check if the contract exists
      const code = await this.publicClient.getBytecode({ address: botAddress });
      if (!code || code === '0x') {
        console.warn(`No contract found at address ${botAddress}`);
        return {
          totalFilled: '0',
          totalSpent: '0',
          profit: '0',
          profitPercentage: '0'
        };
      }
      
      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.walletClient);
      
      // Use Viem readContract pattern
      try {
        const [totalFilled, totalSpent, profit] = await this.publicClient.readContract({
          address: botAddress,
          abi: bot.abi,
          functionName: 'getStrategyPerformance'
        });
        
        console.log('Strategy performance retrieved successfully:', { totalFilled, totalSpent, profit });
        
        return {
          totalFilled: formatTokenAmount(totalFilled, 18),
          totalSpent: formatTokenAmount(totalSpent, 18),
          profit: formatTokenAmount(profit, 18),
          profitPercentage: totalSpent > 0 ? ((profit / totalSpent) * 100).toFixed(2) : '0'
        };
      } catch (performanceError) {
        console.error(`Error getting strategy performance for bot ${botAddress}:`, performanceError);
        return {
          totalFilled: '0',
          totalSpent: '0',
          profit: '0',
          profitPercentage: '0'
        };
      }

    } catch (error) {
      console.error('Error getting strategy performance:', error);
      return {
        totalFilled: '0',
        totalSpent: '0',
        profit: '0',
        profitPercentage: '0'
      };
    }
  }

  // Get token balance
  async getTokenBalance(tokenAddress, userAddress) {
    try {
      // Use Viem to read token balance and decimals
      const [balance, decimals] = await Promise.all([
        this.publicClient.readContract({
          address: tokenAddress,
          abi: [
            { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }
          ],
          functionName: 'balanceOf',
          args: [userAddress]
        }),
        this.publicClient.readContract({
          address: tokenAddress,
          abi: [
            { name: 'decimals', type: 'function', inputs: [], outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view' }
          ],
          functionName: 'decimals'
        })
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
      const priceData = await this.publicClient.readContract({
        address: this.oracleAdapter.address,
        abi: this.oracleAdapter.abi,
        functionName: 'getLatestPrice',
        args: [tokenAddress]
      });
      
      return formatTokenAmount(priceData.price, 18);

    } catch (error) {
      console.error('Error getting current price:', error);
      throw new Error(`Failed to get current price: ${error.message}`);
    }
  }

  // Withdraw tokens from bot
  async withdrawFromBot(botAddress, tokenAddress, amount) {
    try {
      console.log(`Withdrawing ${amount} tokens from bot ${botAddress}`);

      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.walletClient);

      // Simulate the transaction first
      const { request } = await this.publicClient.simulateContract({
        address: botAddress,
        abi: bot.abi,
        functionName: 'withdrawTokens',
        args: [tokenAddress, amount]
      });

      // Write the transaction
      const hash = await this.walletClient.writeContract(request);
      console.log('Withdrawal transaction:', hash);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Withdrawal successful:', receipt);

      return {
        txHash: hash,
        amount: amount.toString()
      };

    } catch (error) {
      console.error('Error withdrawing from bot:', error);
      throw new Error(`Failed to withdraw from bot: ${error.message}`);
    }
  }

  // Get bot balance
  async getBotBalance(botAddress, tokenAddress) {
    try {
      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: [
          { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }
        ],
        functionName: 'balanceOf',
        args: [botAddress]
      });

      return formatTokenAmount(balance, 18);

    } catch (error) {
      console.error('Error getting bot balance:', error);
      throw new Error(`Failed to get bot balance: ${error.message}`);
    }
  }

  // Emergency recover tokens from factory
  async emergencyRecover(tokenAddress, toAddress, amount) {
    try {
      console.log(`Emergency recovering ${amount} tokens to ${toAddress}`);

      // Simulate the transaction first
      const { request } = await this.publicClient.simulateContract({
        address: this.factory.address,
        abi: this.factory.abi,
        functionName: 'emergencyRecover',
        args: [tokenAddress, toAddress, amount]
      });

      // Write the transaction
      const hash = await this.walletClient.writeContract(request);
      console.log('Emergency recovery transaction:', hash);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Emergency recovery successful:', receipt);

      return {
        txHash: hash,
        amount: amount.toString()
      };

    } catch (error) {
      console.error('Error in emergency recovery:', error);
      throw new Error(`Failed to emergency recover: ${error.message}`);
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