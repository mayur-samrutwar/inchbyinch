import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import Navigation from '../components/Navigation';
import PriceDisplay from '../components/PriceDisplay';
import StrategyPerformance from '../components/StrategyPerformance';
import { usePriceFeed } from '../hooks/usePriceFeed';
import { formatEther, parseEther, parseUnits } from 'viem';
import { baseSepolia } from 'wagmi/chains';

export default function Dashboard() {
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalValue: 0,
    profitLoss: 0,
    totalOrders: 0,
    filledOrders: 0,
    averageFillPrice: 0,
    totalVolume: 0
  });
  const [botBalances, setBotBalances] = useState({});
  const [strategyPerformance, setStrategyPerformance] = useState({});
  const [withdrawing, setWithdrawing] = useState(false);

  // Price feed for ETH
  const symbols = useMemo(() => ['ETH'], []);
  const { getPrice, getFormattedPrice } = usePriceFeed(symbols);

  // Contract addresses from environment variables
  const CONTRACT_ADDRESSES = {
    factory: process.env.NEXT_PUBLIC_BASE_SEPOLIA_FACTORY_ADDRESS || '',
    orderManager: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORDER_MANAGER_ADDRESS || '',
    oracleAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORACLE_ADAPTER_ADDRESS || '',
    lopAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_LOP_ADAPTER_ADDRESS || ''
  };

  // Check if we're on the correct network
  const isCorrectNetwork = chainId === baseSepolia.id;

  // Load active orders and calculate stats
  const loadActiveOrders = useCallback(async () => {
    if (!isConnected || !walletClient || !address) return;

    setLoading(true);
    try {
      // Initialize contract service with Wagmi clients
      const contractService = (await import('../utils/contractService')).default;
      await contractService.initialize(publicClient, walletClient);

      // Get user's bots
      const userBots = await contractService.getUserBots(address);
      
      if (userBots.length === 0) {
        console.log('No valid bots found for user');
        setActiveOrders([]);
        setDashboardStats({
          totalValue: 0,
          profitLoss: 0,
          totalOrders: 0,
          filledOrders: 0,
          averageFillPrice: 0,
          totalVolume: 0
        });
        return;
      }
      
      // Get orders from all bots
      const allOrders = [];
      let totalValue = 0;
      let totalFilled = 0;
      let totalVolume = 0;
      let totalProfit = 0;

      for (const botAddress of userBots) {
        try {
          console.log(`Processing bot: ${botAddress}`);
          
          const botOrders = await contractService.getBotOrders(botAddress);
          console.log(`Found ${botOrders.length} orders for bot ${botAddress}`);
          console.log(`Bot orders data:`, botOrders);
          
          const botStrategy = await contractService.getBotStrategy(botAddress);
          console.log(`Strategy for bot ${botAddress}:`, botStrategy);
          console.log(`Strategy isActive: ${botStrategy.isActive}, makerAsset: ${botStrategy.makerAsset}, takerAsset: ${botStrategy.takerAsset}`);
          
          // Transform orders to match UI format
          const transformedOrders = botOrders.map(order => ({
            id: order.index,
            pair: `${botStrategy.makerAsset}/${botStrategy.takerAsset}`,
            price: `$${parseFloat(order.price).toFixed(2)}`,
            size: `${botStrategy.orderSize} ${botStrategy.makerAsset}`,
            status: order.isActive ? 'Active' : 'Filled',
            timestamp: new Date(order.createdAt).toLocaleString(),
            txHash: order.hash.substring(0, 10) + '...' + order.hash.substring(order.hash.length - 8),
            botAddress: botAddress,
            strategyActive: botStrategy.isActive
          }));
          
          // Only show orders from active strategies, or show inactive orders with a note
          if (botStrategy.isActive) {
            allOrders.push(...transformedOrders);
          } else {
            // For inactive strategies, only show filled orders or add a note
            const inactiveOrders = transformedOrders.map(order => ({
              ...order,
              status: 'Inactive Strategy',
              note: 'Strategy is inactive - orders cannot be cancelled'
            }));
            allOrders.push(...inactiveOrders);
          }

          // Calculate stats only if strategy is active
          if (botStrategy.isActive) {
            const activeOrders = botOrders.filter(o => o.isActive);
            const filledOrders = botOrders.filter(o => !o.isActive);
            
            totalFilled += filledOrders.length;
            
            // Calculate total value and volume
            const orderValue = parseFloat(botStrategy.orderSize) * parseFloat(botStrategy.startPrice);
            totalValue += orderValue * activeOrders.length;
            totalVolume += parseFloat(botStrategy.orderSize) * filledOrders.length;

            // Get strategy performance
            try {
              const performance = await contractService.getStrategyPerformance(botAddress);
              totalProfit += parseFloat(performance.profit);
              
              // Store performance data for display
              setStrategyPerformance(prev => ({
                ...prev,
                [botAddress]: {
                  ...performance,
                  strategy: botStrategy
                }
              }));
              
              // Update strategy info with performance data
              console.log(`Strategy performance for ${botAddress}:`, {
                totalFilled: performance.totalFilled,
                totalSpent: performance.totalSpent,
                profit: performance.profit,
                profitPercentage: performance.profitPercentage
              });
            } catch (error) {
              console.error('Error getting performance:', error);
            }
          } else {
            console.log(`Bot ${botAddress} is not active (no strategy created)`);
          }
        } catch (error) {
          console.error(`Error loading orders for bot ${botAddress}:`, error);
          // Continue with other bots
        }
      }

      setActiveOrders(allOrders);
      
      // Update dashboard stats
      setDashboardStats({
        totalValue: totalValue,
        profitLoss: totalProfit,
        totalOrders: allOrders.length,
        filledOrders: totalFilled,
        averageFillPrice: totalFilled > 0 ? totalValue / totalFilled : 0,
        totalVolume: totalVolume
      });

    } catch (error) {
      console.error('Error loading orders:', error);
      // Set empty state on error
      setActiveOrders([]);
      setDashboardStats({
        totalValue: 0,
        profitLoss: 0,
        totalOrders: 0,
        filledOrders: 0,
        averageFillPrice: 0,
        totalVolume: 0
      });
    } finally {
      setLoading(false);
    }
  }, [isConnected, walletClient, address, publicClient]);

  // Load bot balances
  const loadBotBalances = useCallback(async () => {
    if (!isConnected || !walletClient || !address) return;

    try {
      const contractService = (await import('../utils/contractService')).default;
      await contractService.initialize(publicClient, walletClient);

      const userBots = await contractService.getUserBots(address);
      const balances = {};

      for (const botAddress of userBots) {
        try {
          // Get ETH balance
          const ethBalance = await publicClient.getBalance({ address: botAddress });
          balances[botAddress] = {
            ETH: formatEther(ethBalance),
            USDC: '0' // Will be updated if USDC contract is available
          };

          // Try to get USDC balance if contract exists (Base Sepolia USDC)
          try {
            const usdcBalance = await contractService.getBotBalance(botAddress, '0x036cbd53842c5426634e7929541ec2318f3dcf7e'); // Real Base Sepolia USDC
            balances[botAddress].USDC = usdcBalance;
          } catch (error) {
            console.log('USDC not available for this bot');
          }
        } catch (error) {
          console.error(`Error getting balance for bot ${botAddress}:`, error);
        }
      }

      setBotBalances(balances);
    } catch (error) {
      console.error('Error loading bot balances:', error);
    }
  }, [isConnected, walletClient, address, publicClient]);



  // Handle withdrawal
  const handleWithdraw = async (botAddress, token, amount) => {
    if (!isConnected || !walletClient) return;

    setWithdrawing(true);
    try {
      const contractService = (await import('../utils/contractService')).default;
      await contractService.initialize(publicClient, walletClient);

      // Map token symbols to addresses and decimals
      let tokenAddress, amountWei;
      
      if (token === 'ETH') {
        tokenAddress = '0x0000000000000000000000000000000000000000';
        amountWei = parseEther(amount);
      } else if (token === 'USDC') {
        tokenAddress = '0x036cbd53842c5426634e7929541ec2318f3dcf7e'; // Real Base Sepolia USDC
        amountWei = parseUnits(amount, 6);
      } else if (token === 'WETH') {
        tokenAddress = '0x4200000000000000000000000000000000000006'; // WETH on Base Sepolia
        amountWei = parseEther(amount);
      } else {
        throw new Error(`Unsupported token: ${token}`);
      }

      await contractService.withdrawFromBot(botAddress, tokenAddress, amountWei);
      
      alert(`Successfully withdrew ${amount} ${token}!`);
      loadBotBalances(); // Refresh balances
    } catch (error) {
      console.error('Error withdrawing:', error);
      alert('Error withdrawing: ' + error.message);
    } finally {
      setWithdrawing(false);
    }
  };



  useEffect(() => {
    if (isConnected && walletClient && address) {
      loadActiveOrders();
      loadBotBalances();
    }
  }, [isConnected, walletClient, address, loadActiveOrders, loadBotBalances]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Dashboard - inchbyinch</title>
        <meta name="description" content="Active orders and strategy status" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Monitor your active strategies and orders</p>
        </div>

        {/* Network Warning */}
        {isConnected && !isCorrectNetwork && (
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="text-gray-600 text-sm mb-2 font-medium">Active Orders</div>
            <div className="text-2xl font-bold text-gray-900">{activeOrders.filter(o => o.status === 'Active').length}</div>
          </div>
          <div className="card p-6">
            <div className="text-gray-600 text-sm mb-2 font-medium">Total Filled</div>
            <div className="text-2xl font-bold text-gray-900">{dashboardStats.filledOrders}</div>
          </div>
          <div className="card p-6">
            <div className="text-gray-600 text-sm mb-2 font-medium">Total Value</div>
            <div className="text-2xl font-bold text-gray-900">
              {dashboardStats.totalValue > 0 ? `$${dashboardStats.totalValue.toFixed(2)}` : '$0.00'}
            </div>
          </div>
          <div className="card p-6">
            <div className="text-gray-600 text-sm mb-2 font-medium">Profit/Loss</div>
            <div className={`text-2xl font-bold ${dashboardStats.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dashboardStats.profitLoss >= 0 ? '+' : ''}${dashboardStats.profitLoss.toFixed(2)}
            </div>
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
                    <th className="text-left py-3 text-gray-600 font-medium text-sm">Strategy</th>
                    <th className="text-left py-3 text-gray-600 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-gray-500">
                        {isConnected ? 
                          'No active orders found. Deploy a strategy from the homepage to get started.' : 
                          'Connect your wallet to view active orders'
                        }
                      </td>
                    </tr>
                  ) : (
                    activeOrders.map((order, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-4 text-gray-900 text-sm font-mono">#{String(index + 1).padStart(3, '0')}</td>
                        <td className="py-4 text-gray-900 text-sm">{order.pair}</td>
                        <td className="py-4 text-gray-900 text-sm">{order.price}</td>
                        <td className="py-4 text-gray-900 text-sm">{order.size}</td>
                        <td className="py-4">
                          <span className={`badge ${
                            order.status === 'Active' 
                              ? 'badge-success' 
                              : order.status === 'Inactive Strategy'
                              ? 'badge-warning'
                              : 'badge-neutral'
                          }`}>
                            {order.status}
                          </span>
                          {order.note && (
                            <div className="text-xs text-gray-500 mt-1">
                              {order.note}
                            </div>
                          )}
                        </td>
                        <td className="py-4">
                          <span className={`badge ${
                            order.strategyActive 
                              ? 'badge-success' 
                              : 'badge-warning'
                          }`}>
                            {order.strategyActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex space-x-2">
                            <button 
                              className={`btn text-sm ${order.strategyActive ? 'btn-secondary' : 'btn-disabled'}`}
                              disabled={!order.strategyActive}
                              onClick={async () => {
                                if (!order.strategyActive) {
                                  alert('Cannot cancel order: Strategy is inactive.');
                                  return;
                                }
                                
                                try {
                                  const contractService = (await import('../utils/contractService')).default;
                                  await contractService.initialize(publicClient, walletClient);
                                  
                                  // Check if strategy is active before attempting to cancel
                                  const strategy = await contractService.getBotStrategy(order.botAddress);
                                  if (!strategy.isActive) {
                                    alert('Cannot cancel order: Strategy is not active. The strategy may have expired or been cancelled.');
                                    loadActiveOrders(); // Refresh to update UI
                                    return;
                                  }
                                  
                                  await contractService.cancelOrder(order.botAddress, order.id);
                                  alert('Order cancelled successfully!');
                                  loadActiveOrders(); // Refresh orders
                                } catch (error) {
                                  console.error('Error cancelling order:', error);
                                  alert('Error cancelling order: ' + error.message);
                                }
                              }}
                            >
                              Cancel Order
                            </button>
                            <button 
                              className={`btn text-sm ${order.strategyActive ? 'btn-danger' : 'btn-disabled'}`}
                              disabled={!order.strategyActive}
                              onClick={async () => {
                                if (!order.strategyActive) {
                                  alert('Cannot cancel orders: Strategy is inactive.');
                                  return;
                                }
                                
                                try {
                                  const contractService = (await import('../utils/contractService')).default;
                                  await contractService.initialize(publicClient, walletClient);
                                  
                                  // Check if strategy is active before attempting to cancel
                                  const strategy = await contractService.getBotStrategy(order.botAddress);
                                  if (!strategy.isActive) {
                                    alert('Cannot cancel orders: Strategy is not active. The strategy may have expired or been cancelled.');
                                    loadActiveOrders(); // Refresh to update UI
                                    return;
                                  }
                                  
                                  await contractService.cancelAllOrders(order.botAddress);
                                  alert('All orders cancelled successfully!');
                                  loadActiveOrders(); // Refresh orders
                                } catch (error) {
                                  console.error('Error cancelling all orders:', error);
                                  alert('Error cancelling all orders: ' + error.message);
                                }
                              }}
                            >
                              Cancel All
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Strategy Performance */}
        <div className="mt-8">
          {Object.keys(strategyPerformance).length > 0 ? (
            Object.entries(strategyPerformance).map(([botAddress, data]) => (
              <div key={botAddress} className="mb-6">
                <StrategyPerformance 
                  performance={data} 
                  strategy={data.strategy}
                />
              </div>
            ))
          ) : (
            <div className="card p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Strategy Performance</h2>
              <div className="text-center text-gray-500">
                No active strategies found. Deploy a strategy to see performance metrics.
              </div>
            </div>
          )}
        </div>

        {/* Bot Balances & Withdrawal */}
        {isConnected && Object.keys(botBalances).length > 0 && (
          <div className="mt-8 card p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Bot Balances & Withdrawal</h2>
            
            <div className="space-y-4">
              {Object.entries(botBalances).map(([botAddress, balances]) => (
                <div key={botAddress} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-medium text-gray-900">Bot: {botAddress.slice(0, 6)}...{botAddress.slice(-4)}</h3>
                    <button
                      onClick={() => loadBotBalances()}
                      className="btn btn-secondary text-sm"
                    >
                      Refresh
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ETH Balance:</span>
                        <span className="font-medium">{parseFloat(balances.ETH).toFixed(4)} ETH</span>
                      </div>
                      {parseFloat(balances.ETH) > 0 && (
                        <button
                          onClick={() => handleWithdraw(botAddress, 'ETH', balances.ETH)}
                          disabled={withdrawing}
                          className="btn btn-primary text-sm w-full"
                        >
                          {withdrawing ? 'Withdrawing...' : 'Withdraw ETH'}
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">USDC Balance:</span>
                        <span className="font-medium">{parseFloat(balances.USDC).toFixed(2)} USDC</span>
                      </div>
                      {parseFloat(balances.USDC) > 0 && (
                        <button
                          onClick={() => handleWithdraw(botAddress, 'USDC', balances.USDC)}
                          disabled={withdrawing}
                          className="btn btn-primary text-sm w-full"
                        >
                          {withdrawing ? 'Withdrawing...' : 'Withdraw USDC'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Withdrawal Info</h4>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• Withdrawals go directly to your wallet</li>
                <li>• You can withdraw anytime, even during active strategies</li>
                <li>• Withdrawing will not cancel active orders</li>
                <li>• Gas fees apply for withdrawal transactions</li>
              </ul>
            </div>
          </div>
        )}


      </main>
    </div>
  );
} 