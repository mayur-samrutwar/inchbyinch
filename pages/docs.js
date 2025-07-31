import Head from 'next/head';
import Navigation from '../components/Navigation';

export default function Docs() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Documentation - inchbyinch</title>
        <meta name="description" content="Documentation for inchbyinch smart ladder trading" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation 
        onConnect={() => {}}
        isConnected={false}
        account=""
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Documentation</h1>
          
          <div className="prose prose-gray max-w-none">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">What is inchbyinch?</h2>
            <p className="text-gray-600 mb-6">
              inchbyinch is a smart ladder trading automation system built on top of the 1inch Limit Order Protocol (LOP). 
              It enables users to deploy a series of limit orders in a specified price range that automatically manage themselves 
              based on market behavior — including reposting, filling, or flipping to the opposite side.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How it Works</h2>
            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">1. Strategy Configuration</h3>
                <p className="text-blue-800">
                  Configure your trading strategy with token pair, price range, order size, and number of orders.
                </p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-green-900 mb-2">2. Order Deployment</h3>
                <p className="text-green-800">
                  Deploy your strategy onchain using 1inch LOP. Orders are placed automatically across your specified price range.
                </p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">3. Automated Management</h3>
                <p className="text-purple-800">
                  Orders are automatically managed - reposted, cancelled, or flipped based on your configuration and market conditions.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Strategy Types</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="card p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Buy Range</h3>
                <p className="text-sm text-gray-600">
                  Place buy orders below current price. Ideal for accumulating assets during dips.
                </p>
              </div>
              <div className="card p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Sell Range</h3>
                <p className="text-sm text-gray-600">
                  Place sell orders above current price. Perfect for taking profits during rallies.
                </p>
              </div>
              <div className="card p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Buy + Sell</h3>
                <p className="text-sm text-gray-600">
                  Range-bound strategy that buys low and sells high automatically.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Advanced Features</h2>
            <div className="space-y-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Post-Fill Behavior</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li><strong>Next Level:</strong> Move to the next price level after a fill</li>
                  <li><strong>Same Price:</strong> Repost at the same price level</li>
                  <li><strong>Stop:</strong> Stop after one fill</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Flip to Sell</h3>
                <p className="text-gray-600">
                  Automatically flip from buy to sell orders after a successful buy, with a specified percentage markup.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Safety Controls</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Budget limits to prevent overspending</li>
                  <li>Floor price protection</li>
                  <li>Inactivity timeouts</li>
                  <li>Maximum order limits</li>
                </ul>
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Getting Started</h2>
            <div className="space-y-4 mb-6">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Connect Your Wallet</h3>
                  <p className="text-gray-600">Connect your MetaMask or other Web3 wallet to get started.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Configure Your Strategy</h3>
                  <p className="text-gray-600">Choose your token pair, strategy type, and set your parameters.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Deploy and Monitor</h3>
                  <p className="text-gray-600">Deploy your strategy and monitor its performance in the dashboard.</p>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Security</h2>
            <div className="bg-yellow-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Important Security Notes</h3>
              <ul className="list-disc list-inside text-yellow-800 space-y-1">
                <li>All strategies execute onchain using 1inch LOP</li>
                <li>No centralized backend or API dependencies</li>
                <li>Your funds remain in your control</li>
                <li>Always verify contract addresses before deployment</li>
                <li>Start with small amounts to test strategies</li>
              </ul>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Support</h2>
            <p className="text-gray-600 mb-4">
              For support, questions, or feature requests, please reach out to our community:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Discord</h3>
                <p className="text-sm text-gray-600">Join our Discord community for real-time support</p>
              </div>
              <div className="card p-4">
                <h3 className="font-semibold text-gray-900 mb-2">GitHub</h3>
                <p className="text-sm text-gray-600">View source code and report issues</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 