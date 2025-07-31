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
    <div className="min-h-screen bg-gray-50">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Monitor your active strategies and orders</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="text-gray-600 text-sm mb-2 font-medium">Active Orders</div>
            <div className="text-2xl font-bold text-gray-900">{activeOrders.filter(o => o.status === 'Active').length}</div>
          </div>
          <div className="card p-6">
            <div className="text-gray-600 text-sm mb-2 font-medium">Total Filled</div>
            <div className="text-2xl font-bold text-gray-900">{activeOrders.filter(o => o.status === 'Filled').length}</div>
          </div>
          <div className="card p-6">
            <div className="text-gray-600 text-sm mb-2 font-medium">Total Value</div>
            <div className="text-2xl font-bold text-gray-900">
              {getFormattedPrice('ETH') ? `$${(getPrice('ETH') * 0.385).toFixed(2)}` : '$1,250.00'}
            </div>
          </div>
          <div className="card p-6">
            <div className="text-gray-600 text-sm mb-2 font-medium">Profit/Loss</div>
            <div className="text-2xl font-bold text-green-600">+$45.20</div>
          </div>
        </div>

        {/* Active Orders Table */}
        <div className="card p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Active Orders</h2>
            <button
              onClick={loadActiveOrders}
              disabled={loading}
              className="btn btn-secondary"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {!isConnected ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Connect your wallet to view active orders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 text-gray-600 font-medium text-sm">Order ID</th>
                    <th className="text-left py-3 text-gray-600 font-medium text-sm">Token Pair</th>
                    <th className="text-left py-3 text-gray-600 font-medium text-sm">Price</th>
                    <th className="text-left py-3 text-gray-600 font-medium text-sm">Size</th>
                    <th className="text-left py-3 text-gray-600 font-medium text-sm">Status</th>
                    <th className="text-left py-3 text-gray-600 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrders.map((order, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-4 text-gray-900 text-sm font-mono">#{String(index + 1).padStart(3, '0')}</td>
                      <td className="py-4 text-gray-900 text-sm">{order.pair}</td>
                      <td className="py-4 text-gray-900 text-sm">{order.price}</td>
                      <td className="py-4 text-gray-900 text-sm">{order.size}</td>
                      <td className="py-4">
                        <span className={`badge ${
                          order.status === 'Active' 
                            ? 'badge-success' 
                            : 'badge-neutral'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-4">
                        <button className="btn btn-secondary text-sm">
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Strategy Performance */}
        <div className="mt-8 card p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Strategy Performance</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Buy Ladder Strategy</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Total Orders:</span>
                  <span className="text-gray-900 font-medium text-sm">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Filled Orders:</span>
                  <span className="text-gray-900 font-medium text-sm">8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Average Fill Price:</span>
                  <span className="text-gray-900 font-medium text-sm">$3,245.50</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Total Volume:</span>
                  <span className="text-gray-900 font-medium text-sm">0.4 ETH</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Chart</h3>
              <div className="bg-gray-50 rounded-lg p-4 h-48 flex items-center justify-center border border-gray-200">
                <p className="text-gray-500 text-sm">Chart visualization coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 