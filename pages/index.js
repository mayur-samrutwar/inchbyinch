import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { getAddress } from 'viem';
import StrategyForm from '../components/StrategyForm';
import Navigation from '../components/Navigation';
import PriceDisplay from '../components/PriceDisplay';
import { usePriceFeed } from '../hooks/usePriceFeed';
import { useContractAddresses } from '../hooks/useContractAddresses';
import { CONTRACT_ABIS } from '../utils/contracts.js';
import { baseSepolia } from 'wagmi/chains';
import { parseUnits } from 'viem';

export default function Home() {
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const contractAddresses = useContractAddresses();
  
  // Price feed for ETH
  const symbols = useMemo(() => ['ETH'], []);
  const { getPrice, getFormattedPrice, getPriceChange, getFormattedPriceChange, getPriceChangeColor } = usePriceFeed(symbols);
  
  // Strategy preview state
  const [previewConfig, setPreviewConfig] = useState({
    selectedPair: 'ETH/USDC',
    startPrice: '3000',
    spacing: '50',
    orderSize: '0.05',
    numOrders: '10',
    strategyType: 'buy',
    postFillBehavior: 'next',
    budget: '0.2',
    maxOrders: '3',
    cooldownMinutes: '5',
    floorPrice: '2500',
    stopLoss: '0',
    fillPercentage: '75',
    flipToSell: false,
    flipPercentage: '10',
    inactivityHours: '6'
  });

  // Update preview when strategy changes
  const updatePreview = (newConfig) => {
    setPreviewConfig(newConfig);
  };

  // Deploy strategy
  const deployStrategy = async (strategyConfig) => {
    if (!isConnected || !walletClient) {
      alert('Please connect your wallet first!');
      return;
    }

    // Check if user is on Base Sepolia
    if (chainId !== baseSepolia.id) {
      alert('Please switch to Base Sepolia testnet to use this app.');
      return;
    }

    try {
      // Initialize contract service with Wagmi clients
      const contractService = (await import('../utils/contractService')).default;
      await contractService.initialize(publicClient, walletClient);

      // Deploy bot
      console.log('Deploying bot...');
      const botDeployment = await contractService.deployBot(address);
      console.log('Bot deployed at:', botDeployment.botAddress);

      if (botDeployment.isExisting) {
        console.log('Using existing bot:', botDeployment.botAddress);
      } else {
        console.log('New bot deployed:', botDeployment.botAddress);
      }

      // Map form data to contract parameters
      const contractParams = {
        // Token addresses for Base Sepolia (properly checksummed)
        makerAsset: getAddress('0x4200000000000000000000000000000000000006'), // WETH
        takerAsset: getAddress('0x036cbd53842c5426634e7929541ec2318f3dcf7e'), // Real Base Sepolia USDC
        
        // Strategy parameters
        startPrice: strategyConfig.startPrice,
        spacing: strategyConfig.spacing,
        orderSize: strategyConfig.orderSize,
        numOrders: parseInt(strategyConfig.numOrders),
        strategyType: strategyConfig.strategyType === 'buy' ? 0 : strategyConfig.strategyType === 'sell' ? 1 : 2, // 0=buy, 1=sell, 2=both
        repostMode: strategyConfig.postFillBehavior === 'next' ? 0 : strategyConfig.postFillBehavior === 'same' ? 1 : 2, // 0=next, 1=same, 2=stop
        budget: strategyConfig.strategyType === 'buy' ? 
          (() => {
            // Calculate actual budget needed for BUY strategy
            const orderSize = parseFloat(strategyConfig.orderSize);
            const numOrders = parseInt(strategyConfig.numOrders);
            const startPrice = parseFloat(strategyConfig.startPrice);
            const spacing = parseFloat(strategyConfig.spacing);
            
            let totalCost = 0;
            for (let i = 0; i < numOrders; i++) {
              const orderPrice = startPrice - (i * spacing);
              const orderCost = orderSize * orderPrice;
              totalCost += orderCost;
            }
            // Return as string for contract service to convert to wei
            return totalCost.toFixed(2);
          })() : 
          strategyConfig.budget,
        stopLoss: strategyConfig.strategyType === 'buy' ? 
          (parseFloat(strategyConfig.startPrice) * 0.8).toFixed(2) : // 20% below start price for buy (price in USD)
          strategyConfig.floorPrice || '0',
        takeProfit: '0', // Not used for now
        expiryTime: parseInt(strategyConfig.inactivityHours || '6'),
        flipToSell: strategyConfig.flipToSell || false,
        flipPercentage: parseInt(strategyConfig.flipPercentage || '0')
      };

      console.log('Contract parameters:', contractParams);

      // Transfer tokens to bot if needed for buy strategy
      if (contractParams.strategyType === 0) { // BUY_LADDER
        console.log('Transferring USDC to bot for buy strategy...');
        
        // Check user's USDC balance first
        try {
          const userBalance = await contractService.getTokenBalance(contractParams.takerAsset, address);
          const requiredAmount = parseUnits(contractParams.budget, 6);
          
          console.log('User USDC balance:', userBalance);
          console.log('Required USDC amount:', requiredAmount.toString());
          console.log('Budget from form:', contractParams.budget);
          
          // Convert userBalance to number for comparison
          const userBalanceNum = parseFloat(userBalance);
          const requiredAmountNum = parseFloat(contractParams.budget);
          
          console.log('User balance (number):', userBalanceNum);
          console.log('Required amount (number):', requiredAmountNum);
          
          if (userBalanceNum < requiredAmountNum) {
            throw new Error(`Insufficient USDC balance. You have ${userBalanceNum.toFixed(2)} USDC but need ${requiredAmountNum.toFixed(2)} USDC for this strategy.`);
          }
        } catch (error) {
          console.error('Error checking balance, proceeding anyway:', error);
          // Continue with the transfer - let the contract handle the balance check
        }
        
        // Budget is already in USDC units from the form, convert to wei
        const usdcAmount = parseUnits(contractParams.budget, 6); // USDC has 6 decimals
        await contractService.transferTokensToBot(
          botDeployment.botAddress,
          contractParams.takerAsset, // USDC
          usdcAmount,
          address
        );
        console.log('USDC transferred to bot');
        
        // Verify bot received the tokens
        const botBalance = await contractService.getBotBalance(botDeployment.botAddress, contractParams.takerAsset);
        console.log('Bot USDC balance after transfer:', botBalance);
        
        if (botBalance < usdcAmount) {
          throw new Error(`Bot did not receive enough USDC. Bot balance: ${(Number(botBalance) / Math.pow(10, 6)).toFixed(2)} USDC, required: ${contractParams.budget} USDC`);
        }
      }

      // Create strategy on the bot
      console.log('Creating strategy...');
      
      // Test bot contract first
      try {
        await contractService.testBotContract(botDeployment.botAddress);
      } catch (error) {
        console.error('Bot contract test failed:', error);
        throw new Error('Bot contract is not responding correctly. Please try again.');
      }

      // Check if bot is authorized in OrderManager
      try {
              console.log('Contract addresses from hook:', contractAddresses);
      console.log('Current chain ID:', chainId);
      console.log('Available ABIs:', Object.keys(CONTRACT_ABIS));
      console.log('Factory address being used:', contractAddresses.factory);
        
        if (!contractAddresses || !contractAddresses.orderManager) {
          console.error('Contract addresses not available:', contractAddresses);
          console.log('Trying fallback approach...');
          
          // Fallback: Use hardcoded addresses for Base Sepolia
          const fallbackAddresses = {
            factory: '0xD57be8f04cdd21A056bc32f1d26DAc62fB44747A',
            orderManager: '0x88705edFCFd3A55598D071791A2096AC1683036d',
            oracleAdapter: '0xefBAa35F4364933ddD6a66d59e35e9A1Ec19bC46',
            lopAdapter: '0xf7B94C39082113C2FDF63D8997fdf767f0BA15E8'
          };
          
          console.log('Using fallback addresses:', fallbackAddresses);
          
          const isAuthorized = await publicClient.readContract({
            address: fallbackAddresses.orderManager,
            abi: CONTRACT_ABIS.orderManager,
            functionName: 'isBotAuthorized',
            args: [botDeployment.botAddress]
          });
          
          if (!isAuthorized) {
            console.log('Bot not authorized in OrderManager. This is expected for new bots.');
            console.log('The bot will be automatically authorized by the system during deployment.');
            console.log('Proceeding with strategy creation...');
          } else {
            console.log('Bot is already authorized');
          }
        }
        
        const isAuthorized = await publicClient.readContract({
          address: contractAddresses.orderManager,
          abi: CONTRACT_ABIS.orderManager,
          functionName: 'isBotAuthorized',
          args: [botDeployment.botAddress]
        });
        
        if (!isAuthorized) {
          console.log('Bot not authorized in OrderManager. This is expected for new bots.');
          console.log('The bot will be automatically authorized by the system during deployment.');
          console.log('Proceeding with strategy creation...');
        } else {
          console.log('Bot is already authorized');
        }
      } catch (error) {
        console.error('Error checking bot authorization:', error);
        throw new Error('Failed to check bot authorization status.');
      }
      
      const strategyCreation = await contractService.createStrategy(
        botDeployment.botAddress,
        contractParams,
        address // Pass the user's address
      );
      console.log('Strategy created:', strategyCreation.txHash);

      // Place ladder orders
      console.log('Placing ladder orders...');
      const orderPlacement = await contractService.placeLadderOrders(botDeployment.botAddress);
      console.log('Orders placed:', orderPlacement.txHash);

      const botMessage = botDeployment.isExisting 
        ? `Using existing bot: ${botDeployment.botAddress}`
        : `New bot deployed: ${botDeployment.botAddress}`;

      alert(`Strategy deployed successfully!\n${botMessage}\nOrders: ${orderPlacement.orderCount} placed`);
      
    } catch (error) {
      console.error('Error deploying strategy:', error);
      
      // Provide more user-friendly error messages
      let errorMessage = error.message;
      
      if (error.message.includes('InsufficientBalance')) {
        errorMessage = 'Insufficient token balance. Please get test tokens first or reduce your budget.';
      } else if (error.message.includes('InvalidStrategy')) {
        errorMessage = 'Invalid strategy parameters. Please check your configuration and try again.';
      } else if (error.message.includes('InvalidSpacing')) {
        errorMessage = 'Invalid spacing value. Must be between 1% and 1000%.';
      } else if (error.message.includes('InvalidOrderSize')) {
        errorMessage = 'Invalid order size. Must be between 0.001 ETH and 1000 ETH.';
      } else if (error.message.includes('InvalidPrice')) {
        errorMessage = 'Invalid price value. Please check your start price and try again.';
      } else if (error.message.includes('InvalidStopLoss')) {
        errorMessage = 'Invalid stop loss value. Stop loss must be below the start price for buy strategies.';
      } else if (error.message.includes('StrategyAlreadyActive')) {
        errorMessage = 'Strategy is already active. Please cancel the current strategy first.';
      } else if (error.message.includes('0x56a02da8')) {
        errorMessage = 'Contract error. Please try again or contact support.';
      }
      
      alert('Error deploying strategy: ' + errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>inchbyinch - Smart Ladder Trading</title>
        <meta name="description" content="Smart ladder trading automation on 1inch LOP" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          {/* Current Price Display */}
          <div className="inline-flex items-center space-x-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm text-gray-500">Current ETH Price:</span>
            <PriceDisplay symbol="ETH" size="lg" showChange={true} />
          </div>
        </div>

        {/* Network Warning */}
        {isConnected && chainId !== baseSepolia.id && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Wrong Network
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    Please switch to Base Sepolia testnet to use this app.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-12">          
          {/* Strategy Configuration */}
          <div className="max-w-4xl mx-auto w-full">
            <StrategyForm 
              onDeploy={deployStrategy} 
              isConnected={isConnected} 
              onConfigChange={updatePreview} 
            />
          </div>
        </div>

        {/* Quick Access to Dashboard */}
        {isConnected && (
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="card p-8 text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">View Your Active Orders</h2>
              <p className="text-gray-600 mb-6">
                Monitor your deployed strategies and active orders in the dashboard.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 