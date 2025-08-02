import { createPublicClient, createWalletClient, http, getAddress, parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { getNetworkConfig, getContractAddressesForNetwork, CONTRACT_ABIS, createBotContract, createFactoryContract, formatTokenAmount, parseTokenAmount, estimateGasWithBuffer } from './contracts.js';

class ContractService {
  constructor() {
    this.publicClient = null;
    this.walletClient = null;
    this.factory = null;
    this.userBots = new Map();
    this.currentNetwork = null;
  }

  // Initialize with public and wallet clients (called from frontend)
  async initialize(publicClient, walletClient) {
    try {
      console.log('Initializing ContractService with clients');
      
      this.publicClient = publicClient;
      this.walletClient = walletClient;
      
      // Get current chain ID
      const chainId = await this.publicClient.getChainId();
      console.log('Current chain ID:', chainId);
      
      const networkConfig = getNetworkConfig(chainId);
      const contractAddresses = getContractAddressesForNetwork(chainId);
      
      console.log('Network config:', networkConfig);
      console.log('Contract addresses:', contractAddresses);
      
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

  // Fund a bot with ETH for gas
  async fundBot(botAddress, amount) {
    try {
      console.log('Funding bot with ETH:', botAddress, amount);
      
      const { request } = await this.publicClient.simulateContract({
        address: this.factory.address,
        abi: this.factory.abi,
        functionName: 'fundBot',
        args: [botAddress],
        value: parseEther(amount.toString())
      });

      const hash = await this.walletClient.writeContract(request);
      console.log('Bot funding transaction:', hash);
      
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Bot funded successfully:', receipt);
      
      return {
        txHash: hash,
        botAddress: botAddress,
        amount: amount
      };
    } catch (error) {
      console.error('Failed to fund bot:', error);
      throw new Error(`Failed to fund bot: ${error.message}`);
    }
  }

  // Deploy a new bot
  async deployBot(userAddress) {
    try {
      console.log("Deploying bot for user:", userAddress);
      
      // Check if user already has bots
      const existingBots = await this.getUserBots(userAddress);
      console.log("Existing bots for user:", existingBots);
      
      // If user has existing bots, use the first one
      if (existingBots && existingBots.length > 0) {
        console.log("✅ Using existing bot:", existingBots[0]);
        return {
          botAddress: existingBots[0],
          txHash: null,
          isExisting: true,
          message: `Using existing bot: ${existingBots[0]}`
        };
      }
      
      // Required funding: 0.0005 ETH for bot gas (matches contract constant)
      const requiredFunding = parseEther('0.0005'); // BOT_GAS_FUNDING
      
      // First, try to check if the user is the factory owner
      try {
        const factoryOwner = await this.publicClient.readContract({
          address: this.factory.address,
          abi: this.factory.abi,
          functionName: 'owner'
        });
        console.log("Factory owner:", factoryOwner);
        console.log("User address:", userAddress);
        
        if (factoryOwner.toLowerCase() === userAddress.toLowerCase()) {
          console.log("User is factory owner - proceeding with deployBot");
        } else {
          console.log("User is NOT factory owner - this might cause issues");
        }
      } catch (error) {
        console.log("Could not check factory owner:", error.message);
      }
      
      // Try the deployment
      const { request } = await this.publicClient.simulateContract({
        address: this.factory.address,
        abi: this.factory.abi,
        functionName: 'deployBot',
        args: [userAddress],
        value: requiredFunding
      });

      const hash = await this.walletClient.writeContract(request);
      console.log("Bot deployment transaction:", hash);
      
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log("Bot deployed successfully:", receipt);
      
      // Extract bot address from event logs
      let botAddress = null;
      try {
        // Look for BotDeployed event
        const botDeployedEvent = receipt.logs.find(log => {
          // BotDeployed event signature: BotDeployed(address indexed user, address indexed bot)
          return log.topics[0] === '0x8f678cca00000000000000000000000000000000000000000000000000000000';
        });
        
        if (botDeployedEvent) {
          // Extract bot address from the second indexed parameter
          botAddress = '0x' + botDeployedEvent.topics[2].slice(26);
          console.log("✅ Bot address extracted from event:", botAddress);
        } else {
          console.log("❌ BotDeployed event not found in logs");
          // Fallback: get the latest bot for the user
          const userBots = await this.getUserBots(userAddress);
          if (userBots && userBots.length > 0) {
            botAddress = userBots[userBots.length - 1];
            console.log("✅ Using latest user bot as fallback:", botAddress);
          }
        }
      } catch (error) {
        console.log("❌ Error extracting bot address from logs:", error.message);
        // Fallback: get the latest bot for the user
        const userBots = await this.getUserBots(userAddress);
        if (userBots && userBots.length > 0) {
          botAddress = userBots[userBots.length - 1];
          console.log("✅ Using latest user bot as fallback:", botAddress);
        }
      }
      
      if (!botAddress) {
        throw new Error("Could not determine bot address from deployment");
      }
      
      return {
        txHash: hash,
        botAddress: botAddress
      };
    } catch (error) {
      console.error("Error deploying bot:", error);
      
      // Check if it's an ownership error
      if (error.message.includes("OwnableUnauthorizedAccount")) {
        console.log("Factory ownership issue detected");
        throw new Error("Factory ownership issue detected. The deployed Factory contract has an 'onlyOwner' modifier that prevents bot deployment. Please contact support or wait for a contract redeployment.");
      }
      
      throw new Error(`Failed to deploy bot: ${error.message}`);
    }
  }

  // Create a strategy on a bot
  async createStrategy(botAddress, strategyConfig, userAddress) {
    try {
      console.log('Creating strategy on bot:', botAddress);

      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.walletClient);
      
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
      const spacingPercentage = parseInt(spacing); // Keep as percentage, don't convert to wei
      const orderSizeWei = parseTokenAmount(orderSize, 18);
      
      // Convert budget based on strategy type
      // For BUY_LADDER (0): budget should be in USDC (6 decimals)
      // For SELL_LADDER (1): budget should be in ETH (18 decimals) 
      // For BUY_SELL (2): budget should be in USDC (6 decimals)
      let budgetWei;
      if (strategyType === 0 || strategyType === 2) {
        // BUY_LADDER or BUY_SELL - budget in USDC
        budgetWei = parseTokenAmount(budget, 6);
        console.log('Budget conversion - Input:', budget, 'Decimals: 6, Output:', budgetWei.toString());
      } else {
        // SELL_LADDER - budget in ETH
        budgetWei = parseTokenAmount(budget, 18);
        console.log('Budget conversion - Input:', budget, 'Decimals: 18, Output:', budgetWei.toString());
      }
      
      // Convert stopLoss and takeProfit based on strategy type
      // stopLoss and takeProfit should be prices in wei (same units as startPrice)
      let stopLossWei, takeProfitWei;
      if (strategyType === 0 || strategyType === 2) {
        // BUY_LADDER or BUY_SELL - stopLoss as price in wei
        stopLossWei = stopLoss > 0 ? parseTokenAmount(stopLoss, 18) : 0;
        takeProfitWei = takeProfit > 0 ? parseTokenAmount(takeProfit, 18) : 0;
      } else {
        // SELL_LADDER - stopLoss as price in wei
        stopLossWei = stopLoss > 0 ? parseTokenAmount(stopLoss, 18) : 0;
        takeProfitWei = takeProfit > 0 ? parseTokenAmount(takeProfit, 18) : 0;
      }
      
      console.log('Price debug - StartPrice:', startPriceWei.toString(), 'StopLoss:', stopLossWei.toString(), 'TakeProfit:', takeProfitWei.toString());

      console.log('Strategy parameters debug:');
      console.log('- orderSize (input):', orderSize);
      console.log('- orderSizeWei (converted):', orderSizeWei.toString());
      console.log('- MIN_ORDER_SIZE (0.001 ETH):', '1000000000000000');
      console.log('- MAX_ORDER_SIZE (1000 ETH):', '1000000000000000000000000000000000000000');

      // Validate order size
      const MIN_ORDER_SIZE_WEI = BigInt('1000000000000000'); // 0.001 ETH
      const MAX_ORDER_SIZE_WEI = BigInt('1000000000000000000000000000000000000000'); // 1000 ETH
      
      if (orderSizeWei < MIN_ORDER_SIZE_WEI) {
        throw new Error(`Order size too small. Minimum is 0.001 ETH, but you provided ${orderSize} ETH`);
      }
      
      if (orderSizeWei > MAX_ORDER_SIZE_WEI) {
        throw new Error(`Order size too large. Maximum is 1000 ETH, but you provided ${orderSize} ETH`);
      }

      // Validate spacing
      if (spacingPercentage < 1 || spacingPercentage > 1000) {
        throw new Error(`Invalid spacing. Must be between 1% and 1000%, but you provided ${spacingPercentage}%`);
      }

      // Validate numOrders
      if (numOrders < 1 || numOrders > 50) {
        throw new Error(`Invalid number of orders. Must be between 1 and 50, but you provided ${numOrders}`);
      }

      // Validate strategy type
      if (strategyType < 0 || strategyType > 2) {
        throw new Error(`Invalid strategy type. Must be 0 (buy), 1 (sell), or 2 (both), but you provided ${strategyType}`);
      }

      // Validate repost mode
      if (repostMode < 0 || repostMode > 2) {
        throw new Error(`Invalid repost mode. Must be 0 (next), 1 (same), or 2 (stop), but you provided ${repostMode}`);
      }

      // Calculate expiry time
      const currentTime = Math.floor(Date.now() / 1000);
      const expiryTimestamp = currentTime + (expiryTime * 3600); // hours to seconds
      console.log('Time debug - Current:', currentTime, 'Expiry:', expiryTimestamp, 'Hours from now:', expiryTime);

      // Note: Balance check and token transfer are handled in the main page before calling createStrategy
      console.log('Creating strategy with budget:', budget);
      console.log('Strategy parameters for contract call:');
      console.log('- makerAsset:', makerAsset);
      console.log('- takerAsset:', takerAsset);
      console.log('- startPrice:', startPriceWei.toString());
      console.log('- spacing:', spacingPercentage);
      console.log('- orderSize:', orderSizeWei.toString());
      console.log('- numOrders:', numOrders);
      console.log('- strategyType:', strategyType);
      console.log('- repostMode:', repostMode);
      console.log('- budget:', budgetWei.toString());
      console.log('- stopLoss:', stopLossWei.toString());
      console.log('- takeProfit:', takeProfitWei.toString());
      console.log('- expiryTime:', expiryTimestamp);
      console.log('- flipToSell:', flipToSell);
      console.log('- flipPercentage:', flipPercentage);

      // Try to call createStrategy with minimal parameters first
      console.log('Attempting to call createStrategy with minimal validation...');
      
      // Use actual stopLoss and takeProfit values
      console.log('Using actual stopLoss and takeProfit values...');
      const { request } = await this.publicClient.simulateContract({
        address: botAddress,
        abi: CONTRACT_ABIS.bot,
        functionName: 'createStrategy',
        args: [
          makerAsset,
          takerAsset,
          startPriceWei,
          spacingPercentage, // Use percentage directly
          orderSizeWei,
          numOrders,
          strategyType,
          repostMode,
          budgetWei,
          stopLossWei, // Use actual stopLoss
          takeProfitWei, // Use actual takeProfit
          expiryTimestamp,
          flipToSell,
          flipPercentage
        ],
        account: userAddress // Use the provided user address as caller
      });

      const hash = await this.walletClient.writeContract(request);
      console.log('Strategy creation transaction:', hash);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Strategy created successfully:', receipt);

      return {
        txHash: hash,
        strategyId: receipt.logs[0]?.topics[1] // Extract strategy ID from event
      };

    } catch (error) {
      console.error('Error creating strategy:', error);
      
      // Try to decode the error manually
      if (error.message.includes('0x56a02da8')) {
        console.error('Unknown error signature 0x56a02da8 - this might be a custom error not in our ABI');
        console.error('This could indicate:');
        console.error('1. The deployed contract has different validation logic');
        console.error('2. A dependency contract is reverting');
        console.error('3. The contract was deployed with a different version');
        
        // Try to get more error details
        try {
          const errorData = error.data || error.cause?.data;
          if (errorData) {
            console.error('Error data:', errorData);
          }
        } catch (e) {
          console.error('Could not extract error data:', e);
        }
      }
      
      // Provide more helpful error messages
      if (error.message.includes('InsufficientBalance')) {
        throw new Error(`Insufficient token balance. For a BUY strategy, you need USDC tokens. For a SELL strategy, you need ETH tokens. Please get test tokens first or reduce your budget.`);
      }
      
      if (error.message.includes('InvalidStrategy')) {
        throw new Error(`Invalid strategy parameters. Please check your configuration and try again.`);
      }
      
      if (error.message.includes('InvalidSpacing')) {
        throw new Error(`Invalid spacing value. Must be between 1% and 1000%.`);
      }
      
      if (error.message.includes('InvalidOrderSize')) {
        throw new Error(`Invalid order size. Must be between 0.001 ETH and 1000 ETH.`);
      }
      
      if (error.message.includes('InvalidPrice')) {
        throw new Error(`Invalid price value. Please check your start price and try again.`);
      }
      
      if (error.message.includes('InvalidStopLoss')) {
        throw new Error(`Invalid stop loss value. Stop loss must be below the start price for buy strategies.`);
      }
      
      if (error.message.includes('InvalidTakeProfit')) {
        throw new Error(`Invalid take profit value. Take profit must be above the start price for sell strategies.`);
      }
      
      if (error.message.includes('StrategyAlreadyActive')) {
        throw new Error(`Strategy is already active. Please cancel the current strategy first.`);
      }
      
      throw new Error(`Failed to create strategy: ${error.message}`);
    }
  }

  // Place ladder orders
  async placeLadderOrders(botAddress) {
    try {
      console.log('Placing ladder orders on bot:', botAddress);

      const bot = this.userBots.get(botAddress) || createBotContract(botAddress, this.walletClient);

      // Place orders using Viem with user as caller
      const { request } = await this.publicClient.simulateContract({
        address: botAddress,
        abi: CONTRACT_ABIS.bot,
        functionName: 'placeLadderOrders',
        args: [],
        account: this.walletClient.account?.address || this.walletClient.address // Use the user's address as caller
      });

      const hash = await this.walletClient.writeContract(request);
      console.log('Order placement transaction:', hash);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Orders placed successfully:', receipt);

      return {
        txHash: hash,
        orderCount: receipt.logs.filter(log => {
          try {
            // Check if this is an OrderPlaced event
            return log.topics[0] === '0x...'; // OrderPlaced event signature
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
      
      // Return just the address strings, but also create bot instances for internal use
      const validAddresses = [];
      for (const botAddress of botAddresses) {
        if (botAddress !== '0x0000000000000000000000000000000000000000') { // Zero address check
          try {
            // Check if contract exists
            const code = await this.publicClient.getBytecode({ address: botAddress });
            if (!code || code === '0x') {
              console.warn(`No contract found at bot address: ${botAddress}`);
              continue;
            }
            
            // Create bot instance for internal use
            const bot = createBotContract(botAddress, this.walletClient);
            this.userBots.set(botAddress, bot);
            
            // Add to valid addresses list
            validAddresses.push(botAddress);
            
            console.log(`Bot found: ${botAddress}`);
          } catch (botError) {
            console.error(`Error processing bot ${botAddress}:`, botError);
            // Continue with other bots
          }
        }
      }

      console.log(`Found ${validAddresses.length} bots for user`);
      return validAddresses; // Return just the address strings

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
        abi: CONTRACT_ABIS.bot,
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
          abi: CONTRACT_ABIS.bot,
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
                abi: CONTRACT_ABIS.bot,
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

  // Get individual order details
  async getOrder(botAddress, orderIndex) {
    try {
      console.log(`Getting order ${orderIndex} for bot:`, botAddress);
      
      const order = await this.publicClient.readContract({
        address: botAddress,
        abi: CONTRACT_ABIS.bot,
        functionName: 'getOrder',
        args: [orderIndex]
      });
      
      return {
        index: orderIndex.toString(),
        hash: order.orderHash,
        price: formatTokenAmount(order.price, 18),
        isActive: order.isActive,
        createdAt: new Date(order.createdAt * 1000).toISOString()
      };
    } catch (error) {
      console.error('Error getting order:', error);
      throw new Error(`Failed to get order: ${error.message}`);
    }
  }

  // Cancel individual order
  async cancelOrder(botAddress, orderIndex) {
    try {
      console.log(`Cancelling order ${orderIndex} on bot:`, botAddress);

      const { request } = await this.publicClient.simulateContract({
        address: botAddress,
        abi: CONTRACT_ABIS.bot,
        functionName: 'cancelOrder',
        args: [orderIndex]
      });

      const hash = await this.walletClient.writeContract(request);
      console.log('Order cancellation transaction:', hash);

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Order cancelled successfully:', receipt);

      return {
        txHash: hash,
        orderIndex: orderIndex
      };
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }

  // Get user bot count
  async getUserBotCount(userAddress) {
    try {
      const count = await this.publicClient.readContract({
        address: this.factory.address,
        abi: this.factory.abi,
        functionName: 'getUserBotCount',
        args: [userAddress]
      });
      
      return count.toString();
    } catch (error) {
      console.error('Error getting user bot count:', error);
      return '0';
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
        abi: CONTRACT_ABIS.bot,
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
          abi: CONTRACT_ABIS.bot,
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
      // Read token balance
      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: [
          { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }
        ],
        functionName: 'balanceOf',
        args: [userAddress]
      });

      // Use hardcoded decimals for known tokens
      let decimals;
      if (tokenAddress.toLowerCase() === '0x036cbd53842c5426634e7929541ec2318f3dcf7e'.toLowerCase()) {
        // USDC on Base Sepolia
        decimals = 6;
      } else if (tokenAddress.toLowerCase() === '0x4200000000000000000000000000000000000006'.toLowerCase()) {
        // WETH on Base Sepolia
        decimals = 18;
      } else {
        // For unknown tokens, try to read decimals from contract
        try {
          decimals = await this.publicClient.readContract({
            address: tokenAddress,
            abi: [
              { name: 'decimals', type: 'function', inputs: [], outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view' }
            ],
            functionName: 'decimals'
          });
        } catch (error) {
          console.error('Error reading decimals, defaulting to 18:', error);
          decimals = 18;
        }
      }

      console.log('Token balance (wei):', balance.toString());
      console.log('Token decimals:', decimals);
      
      // Convert balance to BigInt and format
      const balanceBigInt = BigInt(balance);
      const formattedBalance = formatUnits(balanceBigInt, decimals);
      console.log('Formatted balance:', formattedBalance);
      
      return formattedBalance;

    } catch (error) {
      console.error('Error getting token balance:', error);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

  // Get current price from oracle
  async getCurrentPrice(tokenAddress) {
    try {
      // Get oracle adapter address from environment
      const oracleAddress = process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORACLE_ADAPTER_ADDRESS;
      
      if (!oracleAddress) {
        throw new Error('Oracle adapter address not configured');
      }

      const priceData = await this.publicClient.readContract({
        address: oracleAddress,
        abi: CONTRACT_ABIS.oracleAdapter,
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
        abi: CONTRACT_ABIS.bot,
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

      // Use hardcoded decimals for known tokens
      let decimals;
      if (tokenAddress.toLowerCase() === '0x036cbd53842c5426634e7929541ec2318f3dcf7e'.toLowerCase()) {
        // USDC on Base Sepolia
        decimals = 6;
      } else if (tokenAddress.toLowerCase() === '0x4200000000000000000000000000000000000006'.toLowerCase()) {
        // WETH on Base Sepolia
        decimals = 18;
      } else {
        decimals = 18; // Default
      }

      // Convert balance to BigInt and format
      const balanceBigInt = BigInt(balance);
      const formattedBalance = formatUnits(balanceBigInt, decimals);
      console.log('Bot balance (wei):', balance.toString());
      console.log('Bot balance (formatted):', formattedBalance);
      
      return formattedBalance;

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

  // Withdraw ETH from factory
  async withdrawETHFromFactory(amount) {
    try {
      console.log(`Withdrawing ${amount} ETH from factory`);

      // Simulate the transaction first
      const { request } = await this.publicClient.simulateContract({
        address: this.factory.address,
        abi: this.factory.abi,
        functionName: 'withdrawETH',
        args: [amount]
      });

      // Write the transaction
      const hash = await this.walletClient.writeContract(request);
      console.log('Factory ETH withdrawal transaction:', hash);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Factory ETH withdrawal successful:', receipt);

      return {
        txHash: hash,
        amount: amount.toString()
      };

    } catch (error) {
      console.error('Error withdrawing ETH from factory:', error);
      throw new Error(`Failed to withdraw ETH from factory: ${error.message}`);
    }
  }

  // Withdraw tokens from factory
  async withdrawTokensFromFactory(tokenAddress, amount) {
    try {
      console.log(`Withdrawing ${amount} tokens from factory`);

      // Simulate the transaction first
      const { request } = await this.publicClient.simulateContract({
        address: this.factory.address,
        abi: this.factory.abi,
        functionName: 'withdrawTokens',
        args: [tokenAddress, amount]
      });

      // Write the transaction
      const hash = await this.walletClient.writeContract(request);
      console.log('Factory token withdrawal transaction:', hash);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('Factory token withdrawal successful:', receipt);

      return {
        txHash: hash,
        amount: amount.toString()
      };

    } catch (error) {
      console.error('Error withdrawing tokens from factory:', error);
      throw new Error(`Failed to withdraw tokens from factory: ${error.message}`);
    }
  }

  // Get factory ETH balance
  async getFactoryETHBalance() {
    try {
      const balance = await this.publicClient.getBalance({
        address: this.factory.address
      });

      return formatEther(balance);

    } catch (error) {
      console.error('Error getting factory ETH balance:', error);
      throw new Error(`Failed to get factory ETH balance: ${error.message}`);
    }
  }

  // Test bot contract functionality
  async testBotContract(botAddress) {
    try {
      console.log('Testing bot contract functionality...');
      
      // Try to read owner
      const owner = await this.publicClient.readContract({
        address: botAddress,
        abi: CONTRACT_ABIS.bot,
        functionName: 'owner'
      });
      
      console.log('Bot owner:', owner);
      
      // Try to read strategy info
      const strategy = await this.publicClient.readContract({
        address: botAddress,
        abi: CONTRACT_ABIS.bot,
        functionName: 'strategy'
      });
      
      console.log('Current strategy:', strategy);
      
      // Try to read constants to verify contract version
      try {
        const maxOrders = await this.publicClient.readContract({
          address: botAddress,
          abi: CONTRACT_ABIS.bot,
          functionName: 'MAX_ORDERS'
        });
        console.log('MAX_ORDERS:', maxOrders.toString());
      } catch (e) {
        console.log('Could not read MAX_ORDERS:', e.message);
      }
      
      try {
        const minSpacing = await this.publicClient.readContract({
          address: botAddress,
          abi: CONTRACT_ABIS.bot,
          functionName: 'MIN_SPACING'
        });
        console.log('MIN_SPACING:', minSpacing.toString());
      } catch (e) {
        console.log('Could not read MIN_SPACING:', e.message);
      }
      
      // Test OrderManager contract
      try {
        const orderManagerAddress = await this.publicClient.readContract({
          address: botAddress,
          abi: CONTRACT_ABIS.bot,
          functionName: 'orderManager'
        });
        console.log('OrderManager address:', orderManagerAddress);
        
        // Try to call a simple function on OrderManager
        const orderManagerOwner = await this.publicClient.readContract({
          address: orderManagerAddress,
          abi: CONTRACT_ABIS.orderManager,
          functionName: 'owner'
        });
        console.log('OrderManager owner:', orderManagerOwner);
        
        // Test OrderManager contract access
        console.log('OrderManager contract access verified');
      } catch (e) {
        console.log('OrderManager test failed:', e.message);
      }
      
      return { owner, strategy };
    } catch (error) {
      console.error('Error testing bot contract:', error);
      throw error;
    }
  }

  // Transfer tokens to bot
  async transferTokensToBot(botAddress, tokenAddress, amount, userAddress) {
    try {
      console.log('Transferring tokens to bot:', tokenAddress, amount);
      console.log('botAddress received:', botAddress);
      console.log('botAddress type:', typeof botAddress);
      console.log('botAddress stringified:', JSON.stringify(botAddress));

      // Validate botAddress
      if (!botAddress || typeof botAddress !== 'string') {
        throw new Error(`Invalid bot address: ${botAddress}. Expected a string address.`);
      }
      
      if (!botAddress.startsWith('0x') || botAddress.length !== 42) {
        throw new Error(`Invalid bot address format: ${botAddress}. Expected a valid 20-byte hex address.`);
      }

      // Create ERC20 contract instance
      const erc20Abi = [
        {
          "constant": false,
          "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"}
          ],
          "name": "transfer",
          "outputs": [{"name": "", "type": "bool"}],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [{"name": "account", "type": "address"}],
          "name": "balanceOf",
          "outputs": [{"name": "", "type": "uint256"}],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        }
      ];

      // Transfer tokens to bot
      const { request } = await this.publicClient.simulateContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [botAddress, amount],
        account: userAddress
      });

      const hash = await this.walletClient.writeContract(request);
      console.log('Token transfer transaction:', hash);

      // Wait for confirmation with retry logic
      let receipt;
      try {
        receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        console.log('Tokens transferred successfully:', receipt);
      } catch (error) {
        console.error('Error waiting for transaction receipt:', error);
        // Check if transaction was successful despite receipt error
        const tx = await this.publicClient.getTransaction({ hash });
        if (tx && tx.status === 'success') {
          console.log('Transaction successful despite receipt error');
          receipt = { hash, status: 'success' };
        } else {
          throw new Error(`Transaction failed: ${error.message}`);
        }
      }

      return {
        txHash: hash,
        success: true
      };

    } catch (error) {
      console.error('Error transferring tokens to bot:', error);
      throw new Error(`Failed to transfer tokens to bot: ${error.message}`);
    }
  }

  // Check if network is supported
  isNetworkSupported(chainId) {
    return chainId === 84532; // Base Sepolia
  }

  // Get supported networks
  getSupportedNetworks() {
    return [{ chainId: 84532, name: 'Base Sepolia' }];
  }

}

// Create singleton instance
const contractService = new ContractService();

export default contractService; 