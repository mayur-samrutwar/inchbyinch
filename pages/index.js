import { useState } from 'react';
import Head from 'next/head';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import StrategyForm from '../components/StrategyForm';
import Navigation from '../components/Navigation';
import PriceDisplay from '../components/PriceDisplay';
import { usePriceFeed } from '../hooks/usePriceFeed';
import { sepolia } from 'wagmi/chains';

export default function Home() {
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  // Price feed for ETH
  const { getPrice, getFormattedPrice, getPriceChange, getFormattedPriceChange, getPriceChangeColor } = usePriceFeed(['ETH']);
  
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

    // Check if user is on Sepolia
    if (chainId !== sepolia.id) {
      alert('Please switch to Sepolia testnet to use this app.');
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

      // Create strategy on the bot
      console.log('Creating strategy...');
      const strategyCreation = await contractService.createStrategy(
        botDeployment.botAddress,
        strategyConfig
      );
      console.log('Strategy created:', strategyCreation.txHash);

      // Place ladder orders
      console.log('Placing ladder orders...');
      const orderPlacement = await contractService.placeLadderOrders(botDeployment.botAddress);
      console.log('Orders placed:', orderPlacement.txHash);

      alert(`Strategy deployed successfully!\nBot: ${botDeployment.botAddress}\nOrders: ${orderPlacement.orderCount} placed`);
      
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
        {isConnected && chainId !== sepolia.id && (
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
                    Please switch to Sepolia testnet to use this app.
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

        {/* Active Orders Section */}
        <div className="mt-16 card p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">Active Orders</h2>
          
          {!isConnected ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Connect your wallet to view active orders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-gray-600 font-medium py-4">Order ID</th>
                    <th className="text-gray-600 font-medium py-4">Token Pair</th>
                    <th className="text-gray-600 font-medium py-4">Price</th>
                    <th className="text-gray-600 font-medium py-4">Size</th>
                    <th className="text-gray-600 font-medium py-4">Status</th>
                    <th className="text-gray-600 font-medium py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-4 text-gray-900 font-mono">#001</td>
                    <td className="py-4 text-gray-900">ETH/USDC</td>
                    <td className="py-4 text-gray-900">$3,200.00</td>
                    <td className="py-4 text-gray-900">0.1 ETH</td>
                    <td className="py-4">
                      <span className="badge badge-success">Active</span>
                    </td>
                    <td className="py-4">
                      <button className="btn btn-secondary text-sm">
                        Cancel
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 