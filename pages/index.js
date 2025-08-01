import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { getAddress } from 'viem';
import StrategyForm from '../components/StrategyForm';
import Navigation from '../components/Navigation';
import PriceDisplay from '../components/PriceDisplay';
import { usePriceFeed } from '../hooks/usePriceFeed';
import { baseSepolia } from 'wagmi/chains';
import { parseUnits } from 'viem';

export default function Home() {
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
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
    budget: '1500',
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
        takerAsset: getAddress('0x036cbd53842c5426634e7929541ec2318f3dcf7e'), // USDC (corrected)
        
        // Strategy parameters
        startPrice: strategyConfig.startPrice,
        spacing: strategyConfig.spacing,
        orderSize: strategyConfig.orderSize,
        numOrders: parseInt(strategyConfig.numOrders),
        strategyType: strategyConfig.strategyType === 'buy' ? 0 : strategyConfig.strategyType === 'sell' ? 1 : 2, // 0=buy, 1=sell, 2=both
        repostMode: strategyConfig.postFillBehavior === 'next' ? 0 : strategyConfig.postFillBehavior === 'same' ? 1 : 2, // 0=next, 1=same, 2=stop
        budget: strategyConfig.budget,
        stopLoss: strategyConfig.floorPrice || '0',
        takeProfit: '0', // Not used for now
        expiryTime: parseInt(strategyConfig.inactivityHours || '6'),
        flipToSell: strategyConfig.flipToSell || false,
        flipPercentage: parseInt(strategyConfig.flipPercentage || '0')
      };

      console.log('Contract parameters:', contractParams);

      // Transfer tokens to bot if needed for buy strategy
      if (contractParams.strategyType === 0) { // BUY_LADDER
        console.log('Transferring USDC to bot for buy strategy...');
        const usdcAmount = parseUnits(contractParams.budget, 6); // USDC has 6 decimals
        await contractService.transferTokensToBot(
          botDeployment.botAddress,
          contractParams.takerAsset, // USDC
          usdcAmount,
          address
        );
        console.log('USDC transferred to bot');
      }

      // Create strategy on the bot
      console.log('Creating strategy...');
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
      alert('Error deploying strategy: ' + error.message);
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
              <a 
                href="/dashboard" 
                className="btn btn-primary"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 