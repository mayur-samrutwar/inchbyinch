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
  
  // Contract addresses
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
    <div className="min-h-screen bg-gray-50">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            inchbyinch
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Smart Ladder Trading on 1inch LOP
          </p>
          
          {/* Current Price Display */}
          <div className="inline-flex items-center space-x-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm text-gray-500">Current ETH Price:</span>
            <PriceDisplay symbol="ETH" size="lg" showChange={true} />
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Strategy Configuration */}
          <div>
            <StrategyForm 
              onDeploy={deployStrategy} 
              isConnected={isConnected} 
              onConfigChange={updatePreview} 
            />
          </div>

          {/* Strategy Preview */}
          <div className="card p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-8">Strategy Preview</h2>
            
            {/* Ladder Visualization */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Order Ladder</h3>
              <div className="space-y-3">
                {Array.from({ length: parseInt(previewConfig.numOrders) || 5 }, (_, i) => {
                  const price = parseFloat(previewConfig.startPrice) - (i * parseFloat(previewConfig.spacing));
                  return (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="font-medium text-gray-900">Order {i + 1}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">${price.toFixed(2)}</div>
                        <div className="text-sm text-gray-500">{previewConfig.orderSize} ETH</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strategy Summary */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Orders:</span>
                    <span className="font-medium text-gray-900">{previewConfig.numOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Size:</span>
                    <span className="font-medium text-gray-900">{previewConfig.orderSize} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Price Range:</span>
                    <span className="font-medium text-gray-900">
                      ${(parseFloat(previewConfig.startPrice) - (parseFloat(previewConfig.numOrders) - 1) * parseFloat(previewConfig.spacing)).toFixed(2)} - ${previewConfig.startPrice}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Price:</span>
                    <span className="font-medium text-gray-900">
                      ${((parseFloat(previewConfig.startPrice) + (parseFloat(previewConfig.startPrice) - (parseFloat(previewConfig.numOrders) - 1) * parseFloat(previewConfig.spacing))) / 2).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Spend:</span>
                    <span className="font-medium text-gray-900">
                      ${(parseFloat(previewConfig.orderSize) * parseFloat(previewConfig.numOrders) * parseFloat(previewConfig.startPrice)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Budget:</span>
                    <span className="font-medium text-gray-900">${previewConfig.budget}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Post-Fill:</span>
                    <span className="font-medium text-gray-900 capitalize">{previewConfig.postFillBehavior || 'next'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Orders:</span>
                    <span className="font-medium text-gray-900">{previewConfig.maxOrders || '3'}</span>
                  </div>
                </div>
              </div>
            </div>
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