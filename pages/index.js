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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AlertTriangle, TrendingUp, Zap, Shield } from 'lucide-react';
import Link from 'next/link';

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
        
        // Strategy parameters - use the pre-processed values from StrategyForm
        startPrice: strategyConfig.startPrice,
        spacing: strategyConfig.spacing,
        orderSize: strategyConfig.orderSize,
        numOrders: strategyConfig.numOrders,
        strategyType: strategyConfig.strategyType, // Already converted to contract enum
        repostMode: strategyConfig.repostMode, // Already converted to contract enum
        budget: strategyConfig.budget, // Already calculated for buy strategies
        stopLoss: strategyConfig.stopLoss,
        takeProfit: strategyConfig.takeProfit,
        expiryTime: strategyConfig.expiryTime, // Already converted to hours
        flipToSell: strategyConfig.flipToSell,
        flipPercentage: strategyConfig.flipPercentage
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
        
        // Debug: Check what botAddress actually is
        console.log('botDeployment:', botDeployment);
        console.log('botDeployment.botAddress:', botDeployment.botAddress);
        console.log('botDeployment.botAddress type:', typeof botDeployment.botAddress);
        
        await contractService.transferTokensToBot(
          botDeployment.botAddress, // This should be a string address
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
            factory: '0x58C39262728e96BA47B6C0B6F9258121b5DFd8E5',
            orderManager: '0x03b902DAa3d882C2C9e14dA96B69D3136EEBa65a',
            oracleAdapter: '0x55C484B25700aC5d169298E6fbe4169fca660E45',
            lopAdapter: '0x66Fd08dA331790b28A056CB0887ECfE6502f046E'
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

      const botMessage = botDeployment.message 
        ? botDeployment.message
        : botDeployment.isExisting 
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
      } else if (error.message.includes('InvalidTakeProfit')) {
        errorMessage = 'Invalid take profit value. Take profit must be above the start price for sell strategies.';
      } else if (error.message.includes('StrategyAlreadyActive')) {
        errorMessage = 'Strategy is already active. Please cancel the current strategy first.';
      } else if (error.message.includes('StrategyNotActive')) {
        errorMessage = 'No active strategy found. Please create a strategy first.';
      } else if (error.message.includes('OrderNotFound')) {
        errorMessage = 'Order not found. The order may have been already filled or cancelled.';
      } else if (error.message.includes('StopLossTriggered')) {
        errorMessage = 'Stop loss triggered. Strategy has been cancelled.';
      } else if (error.message.includes('TakeProfitTriggered')) {
        errorMessage = 'Take profit triggered. Strategy has been cancelled.';
      } else if (error.message.includes('StrategyExpired')) {
        errorMessage = 'Strategy has expired. Please create a new strategy.';
      } else if (error.message.includes('ExceedsBudget')) {
        errorMessage = 'Strategy exceeds budget limits. Please reduce order size or number of orders.';
      } else if (error.message.includes('0x56a02da8')) {
        errorMessage = 'Contract error. Please try again or contact support.';
      } else if (error.message.includes('Factory ownership issue detected')) {
        errorMessage = 'Factory ownership issue detected. The Factory contract has an unexpected ownership restriction that prevents bot deployment. Please contact support or wait for a contract redeployment.';
      }
      
      alert('Error deploying strategy: ' + errorMessage);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/bg.jpg)' }}
      />

      <Head>
        <title>inchbyinch - Smart Ladder Trading</title>
        <meta name="description" content="Smart ladder trading automation on 1inch LOP" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation />

      <main className="relative mx-auto px-4 sm:px-6 lg:px-8 mt-2 rounded-xl h-full">
        {/* Network Warning */}
        {isConnected && chainId !== baseSepolia.id && (
          <div className="max-w-4xl mx-auto mb-8">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please switch to Base Sepolia testnet to use this app.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Main Content - Centered */}
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-full max-w-4xl text-center">
            {/* Title Text
            <div className="mb-12">
              <h1 className="text-3xl font-bold text-white mb-4">
                <span className="text-white">DeFi Trading</span>
                <span className="bg-gradient-to-r from-black to-white bg-clip-text text-transparent"> Revolution</span>
              </h1>
            </div> */}

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
            <Card className="text-center border-0 shadow-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl">View Your Active Orders</CardTitle>
                <CardDescription>
                  Monitor your deployed strategies and active orders in the dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Link href="/dashboard">
                    Go to Dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
} 