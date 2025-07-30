import Head from 'next/head';
import Navigation from '../components/Navigation';

export default function Docs() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <Head>
        <title>Documentation - inchbyinch</title>
        <meta name="description" content="Documentation for inchbyinch smart ladder trading" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Documentation</h1>
          
          <div className="space-y-8">
            {/* Overview */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
              <p className="text-blue-200 mb-4">
                inchbyinch is a smart ladder trading system built on top of the 1inch Limit Order Protocol (LOP). 
                It enables users to deploy sophisticated ladder trading strategies that automatically manage themselves 
                based on market behavior.
              </p>
              <p className="text-blue-200">
                All strategies execute fully onchain using LOP native structures, without relying on any 1inch APIs or backend.
              </p>
            </div>

            {/* How It Works */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">1. Strategy Configuration</h3>
                  <p className="text-blue-200">
                    Configure your ladder strategy by selecting token pairs, setting price ranges, order sizes, 
                    and repost behavior. The system supports buy ladders, sell ladders, and combined strategies.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">2. Bot Deployment</h3>
                  <p className="text-blue-200">
                    Deploy a smart contract bot that will manage your strategy. The bot uses the 1inch LOP 
                    to place limit orders and automatically handles reposting and order management.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">3. Automated Execution</h3>
                  <p className="text-blue-200">
                    Once deployed, your bot automatically places orders, monitors fills, and reposts orders 
                    according to your strategy configuration. All execution happens onchain.
                  </p>
                </div>
              </div>
            </div>

            {/* Strategy Types */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">Strategy Types</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Buy Ladder</h3>
                  <p className="text-blue-200 text-sm">
                    Place buy orders below current price. As price drops, orders get filled and can be 
                    reposted at lower levels or moved to the next price level.
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Sell Ladder</h3>
                  <p className="text-blue-200 text-sm">
                    Place sell orders above current price. As price rises, orders get filled and can be 
                    reposted at higher levels or moved to the next price level.
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Buy & Sell</h3>
                  <p className="text-blue-200 text-sm">
                    Place orders on both sides of current price. This creates a grid strategy that 
                    captures both upward and downward price movements.
                  </p>
                </div>
              </div>
            </div>

            {/* Repost Modes */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">Repost Modes</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Same Price</h3>
                  <p className="text-blue-200 text-sm">
                    When an order is filled, repost at the same price level. This maintains your 
                    position at that price point.
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Next Price</h3>
                  <p className="text-blue-200 text-sm">
                    When an order is filled, move to the next price level in your ladder. This 
                    follows the market trend.
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Skip</h3>
                  <p className="text-blue-200 text-sm">
                    Don't repost after an order is filled. This reduces your position size as 
                    orders get filled.
                  </p>
                </div>
              </div>
            </div>

            {/* Contract Addresses */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">Contract Addresses (Sepolia)</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-blue-200">Factory:</span>
                  <span className="text-white font-mono text-sm">0x7DB4A9Cc0BDF94978cC5A2f136465942E69fcc0E</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-200">Order Manager:</span>
                  <span className="text-white font-mono text-sm">0x52339FDdf8bf7dFb2FE1973575B7713314d80Bc4</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-200">Oracle Adapter:</span>
                  <span className="text-white font-mono text-sm">0xA218913B620603788369a49DbDe0283C161dd27C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-200">1inch LOP:</span>
                  <span className="text-white font-mono text-sm">0x3ef51736315f52d568d6d2cf289419b9cfffe782</span>
                </div>
              </div>
            </div>

            {/* Getting Started */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">Getting Started</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">1. Connect Wallet</h3>
                  <p className="text-blue-200">
                    Connect your MetaMask wallet to the application. Make sure you're connected to the Sepolia testnet.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">2. Configure Strategy</h3>
                  <p className="text-blue-200">
                    Select your token pair, set the price range, order size, and number of orders. 
                    Choose your strategy type and repost mode.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">3. Deploy Strategy</h3>
                  <p className="text-blue-200">
                    Click "Deploy Strategy" to deploy your bot. This will create a smart contract 
                    that manages your ladder orders.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">4. Monitor Performance</h3>
                  <p className="text-blue-200">
                    Use the Dashboard to monitor your active orders, track performance, and manage your strategies.
                  </p>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">Security</h2>
              <div className="space-y-3">
                <p className="text-blue-200">
                  • All contracts are deployed on Sepolia testnet for testing
                </p>
                <p className="text-blue-200">
                  • Smart contracts use OpenZeppelin libraries for security
                </p>
                <p className="text-blue-200">
                  • Access control and reentrancy guards implemented
                </p>
                <p className="text-blue-200">
                  • Budget limits and stop conditions available
                </p>
                <p className="text-blue-200">
                  • Emergency cancel functions for all orders
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 