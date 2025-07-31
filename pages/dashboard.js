import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { ethers } from 'ethers';
import WalletConnect from '../components/WalletConnect';
import Navigation from '../components/Navigation';
import PriceDisplay from '../components/PriceDisplay';
import { usePriceFeed } from '../hooks/usePriceFeed';

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Price feed for ETH
  const { getPrice, getFormattedPrice } = usePriceFeed(['ETH']);

  // Contract addresses
  const CONTRACT_ADDRESSES = {
    factory: '0x7DB4A9Cc0BDF94978cC5A2f136465942E69fcc0E',
    orderManager: '0x52339FDdf8bf7dFb2FE1973575B7713314d80Bc4',
    oracleAdapter: '0xA218913B620603788369a49DbDe0283C161dd27C'
  };

  // Connect wallet
  const handleConnect = (accountAddress, providerInstance, signerInstance) => {
    setAccount(accountAddress);
    setProvider(providerInstance);
    setSigner(signerInstance);
    setIsConnected(!!accountAddress);
  };

  // Load active orders
  const loadActiveOrders = useCallback(async () => {
    if (!isConnected || !signer) return;

    setLoading(true);
    try {
      // Mock data for now - in real implementation, this would query the contracts
      const mockOrders = [
        {
          id: '001',
          pair: 'ETH/USDC',
          price: '$3,200.00',
          size: '0.1 ETH',
          status: 'Active',
          timestamp: '2024-01-15 14:30:00',
          txHash: '0x1234...5678'
        },
        {
          id: '002',
          pair: 'ETH/USDC',
          price: '$3,150.00',
          size: '0.1 ETH',
          status: 'Filled',
          timestamp: '2024-01-15 14:25:00',
          txHash: '0x8765...4321'
        }
      ];

      setActiveOrders(mockOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }, [isConnected, signer]);

  useEffect(() => {
    if (isConnected) {
      loadActiveOrders();
    }
  }, [isConnected, loadActiveOrders]);

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>Dashboard - inchbyinch</title>
        <meta name="description" content="Active orders and strategy status" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation 
        onConnect={handleConnect}
        isConnected={isConnected}
        account={account}
      />

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-light text-black mb-3">Dashboard</h1>
          <p className="text-gray-600">Monitor your active strategies and orders</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="text-gray-600 text-sm mb-3 font-medium">Active Orders</div>
            <div className="text-3xl font-semibold text-black">{activeOrders.filter(o => o.status === 'Active').length}</div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="text-gray-600 text-sm mb-3 font-medium">Total Filled</div>
            <div className="text-3xl font-semibold text-black">{activeOrders.filter(o => o.status === 'Filled').length}</div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="text-gray-600 text-sm mb-3 font-medium">Total Value</div>
            <div className="text-3xl font-semibold text-black">
              {getFormattedPrice('ETH') ? `$${(getPrice('ETH') * 0.385).toFixed(2)}` : '$1,250.00'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="text-gray-600 text-sm mb-3 font-medium">Profit/Loss</div>
            <div className="text-3xl font-semibold text-green-600">+$45.20</div>
          </div>
        </div>

        {/* Active Orders Table */}
        <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-light text-black">Active Orders</h2>
            <button
              onClick={loadActiveOrders}
              disabled={loading}
              className="bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {!isConnected ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">Connect your wallet to view active orders</p>
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No active orders found</p>
              <p className="text-gray-500 text-sm mt-2">Deploy a strategy to get started</p>
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
                    <th className="text-gray-600 font-medium py-4">Time</th>
                    <th className="text-gray-600 font-medium py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100">
                      <td className="py-4 text-black font-mono">#{order.id}</td>
                      <td className="py-4 text-black">{order.pair}</td>
                      <td className="py-4 text-black">{order.price}</td>
                      <td className="py-4 text-black">{order.size}</td>
                      <td className="py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.status === 'Active' 
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-4 text-gray-600 text-sm">{order.timestamp}</td>
                      <td className="py-4">
                        <div className="flex space-x-2">
                          <button className="bg-gray-200 hover:bg-gray-300 text-black px-3 py-1 rounded text-sm font-medium">
                            Cancel
                          </button>
                          <a 
                            href={`https://sepolia.etherscan.io/tx/${order.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-black hover:bg-gray-800 text-white px-3 py-1 rounded text-sm font-medium"
                          >
                            View
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Strategy Performance */}
        <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">Strategy Performance</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Buy Ladder Strategy</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-blue-200">Orders Placed:</span>
                  <span className="text-white">5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Orders Filled:</span>
                  <span className="text-white">2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Success Rate:</span>
                  <span className="text-white">40%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Total Spent:</span>
                  <span className="text-white">$640.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Current Value:</span>
                  <span className="text-white">$685.20</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Profit/Loss:</span>
                  <span className="text-green-400">+$45.20 (+7.1%)</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Price Chart</h3>
              <div className="bg-white/5 rounded-lg p-4 h-48 flex items-center justify-center">
                <p className="text-blue-200">Chart visualization coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 