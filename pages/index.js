import { useState, useEffect } from 'react';
import Head from 'next/head';
import { ethers } from 'ethers';
import WalletConnect from '../components/WalletConnect';
import StrategyForm from '../components/StrategyForm';
import Navigation from '../components/Navigation';
import PriceDisplay from '../components/PriceDisplay';
import { usePriceFeed } from '../hooks/usePriceFeed';

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  
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
    repostMode: 'next',
    budget: '1500',
    maxOrders: '3',
    cooldownMinutes: '5',
    floorPrice: '2500',
    stopLoss: '0',
    fillPercentage: '75',
    postFillBehavior: 'next',
    flipToSell: false,
    flipPercentage: '10',
    inactivityHours: '6'
  });
  
  // Contract addresses (from our deployment)
  const CONTRACT_ADDRESSES = {
    factory: '0x7DB4A9Cc0BDF94978cC5A2f136465942E69fcc0E',
    orderManager: '0x52339FDdf8bf7dFb2FE1973575B7713314d80Bc4',
    oracleAdapter: '0xA218913B620603788369a49DbDe0283C161dd27C'
  };

  // Update preview when strategy changes
  const updatePreview = (newConfig) => {
    setPreviewConfig(newConfig);
  };

  // Connect wallet
  const handleConnect = (accountAddress, providerInstance, signerInstance) => {
    setAccount(accountAddress);
    setProvider(providerInstance);
    setSigner(signerInstance);
    setIsConnected(!!accountAddress);
  };

  // Deploy strategy
  const deployStrategy = async (strategyConfig) => {
    if (!isConnected || !signer) {
      alert('Please connect your wallet first!');
      return;
    }

    try {
      // Factory contract ABI (simplified)
      const factoryABI = [
        "function deployBot(address user) external payable returns (address bot)",
        "event BotDeployed(address indexed user, address indexed bot, uint256 indexed botIndex, uint256 deploymentCost)"
      ];

      const factory = new ethers.Contract(CONTRACT_ADDRESSES.factory, factoryABI, signer);
      
      // Deploy bot
      const deploymentCost = ethers.parseEther('0.01');
      const tx = await factory.deployBot(account, { value: deploymentCost });
      
      console.log('Deploying bot...', tx.hash);
      
      const receipt = await tx.wait();
      console.log('Bot deployed!', receipt);
      
      // TODO: Initialize strategy on the deployed bot with strategyConfig
      alert('Strategy deployed successfully!');
      
    } catch (error) {
      console.error('Error deploying strategy:', error);
      alert('Error deploying strategy: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>inchbyinch - Smart Ladder Trading</title>
        <meta name="description" content="Smart ladder trading automation on 1inch LOP" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation 
        onConnect={handleConnect}
        isConnected={isConnected}
        account={account}
      />

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-light text-black mb-6 tracking-tight">
            inchbyinch
          </h1>
          <p className="text-xl text-gray-600 mb-8 font-light">
            Smart Ladder Trading on 1inch LOP
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Strategy Configuration */}
          <StrategyForm onDeploy={deployStrategy} isConnected={isConnected} onConfigChange={updatePreview} />

          {/* Strategy Preview */}
          <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
            <h2 className="text-2xl font-light text-black mb-8">Strategy Preview</h2>
            
            {/* Current Price */}
            <div className="mb-8">
              <div className="text-gray-600 text-sm mb-3 font-medium">Current Price</div>
              <PriceDisplay symbol="ETH" size="xl" showChange={true} showSource={true} />
            </div>

            {/* Ladder Visualization */}
            <div className="mb-8">
              <div className="text-gray-600 text-sm mb-4 font-medium">Order Ladder</div>
              <div className="space-y-3">
                {Array.from({ length: parseInt(previewConfig.numOrders) || 5 }, (_, i) => {
                  const price = parseFloat(previewConfig.startPrice) - (i * parseFloat(previewConfig.spacing));
                  return (
                    <div key={i} className="flex items-center justify-between bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-black"></div>
                        <span className="text-black font-medium">Order {i + 1}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-black font-semibold">${price.toFixed(2)}</div>
                        <div className="text-gray-600 text-sm">{previewConfig.orderSize} ETH</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strategy Summary */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-black font-semibold mb-4">Strategy Summary</h3>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Orders:</span>
                    <span className="text-black font-medium">{previewConfig.numOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Size:</span>
                    <span className="text-black font-medium">{previewConfig.orderSize} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Price Range:</span>
                    <span className="text-black font-medium">${(parseFloat(previewConfig.startPrice) - (parseFloat(previewConfig.numOrders) - 1) * parseFloat(previewConfig.spacing)).toFixed(2)} - ${previewConfig.startPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Price:</span>
                    <span className="text-black font-medium">${((parseFloat(previewConfig.startPrice) + (parseFloat(previewConfig.startPrice) - (parseFloat(previewConfig.numOrders) - 1) * parseFloat(previewConfig.spacing))) / 2).toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Spend:</span>
                    <span className="text-black font-medium">${(parseFloat(previewConfig.orderSize) * parseFloat(previewConfig.numOrders) * parseFloat(previewConfig.startPrice)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Budget:</span>
                    <span className="text-black font-medium">${previewConfig.budget}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Post-Fill:</span>
                    <span className="text-black font-medium capitalize">{previewConfig.postFillBehavior || 'next'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Orders:</span>
                    <span className="text-black font-medium">{previewConfig.maxOrders || '3'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Orders Section */}
        <div className="mt-16 bg-gray-50 rounded-2xl p-8 border border-gray-200">
          <h2 className="text-2xl font-light text-black mb-8">Active Orders</h2>
          
          {!isConnected ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Connect your wallet to view active orders</p>
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
                    <td className="py-4 text-black font-mono">#001</td>
                    <td className="py-4 text-black">ETH/USDC</td>
                    <td className="py-4 text-black">$3,200.00</td>
                    <td className="py-4 text-black">0.1 ETH</td>
                    <td className="py-4">
                      <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-medium">
                        Active
                      </span>
                    </td>
                    <td className="py-4">
                      <button className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
