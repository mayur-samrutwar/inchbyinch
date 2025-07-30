import { useState } from 'react';

export default function StrategyForm({ onDeploy, isConnected, onConfigChange }) {
  const [selectedPair, setSelectedPair] = useState('ETH/USDC');
  const [startPrice, setStartPrice] = useState('3000');
  const [spacing, setSpacing] = useState('50');
  const [orderSize, setOrderSize] = useState('0.1');
  const [numOrders, setNumOrders] = useState('5');
  const [strategyType, setStrategyType] = useState('buy');
  const [repostMode, setRepostMode] = useState('next');
  const [budget, setBudget] = useState('1');
  const [isDeploying, setIsDeploying] = useState(false);

  const TOKEN_PAIRS = [
    { label: 'ETH/USDC', makerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', takerAsset: '0xA0b86a33E6441b8c4C8C1C1C0B8C4C8C1C1C0B8C4' },
    { label: 'WETH/USDC', makerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', takerAsset: '0xA0b86a33E6441b8c4C8C1C1C0B8C4C8C1C1C0B8C4' },
    { label: 'WBTC/ETH', makerAsset: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', takerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' }
  ];

  // Update preview when config changes
  const updateConfig = (field, value) => {
    const newConfig = {
      selectedPair,
      startPrice,
      spacing,
      orderSize,
      numOrders,
      strategyType,
      repostMode,
      budget,
      [field]: value
    };
    
    if (onConfigChange) {
      onConfigChange(newConfig);
    }
  };

  const handleDeploy = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    setIsDeploying(true);
    try {
      const strategy = {
        selectedPair,
        startPrice: parseFloat(startPrice),
        spacing: parseFloat(spacing),
        orderSize: parseFloat(orderSize),
        numOrders: parseInt(numOrders),
        strategyType,
        repostMode,
        budget: parseFloat(budget)
      };
      
      await onDeploy(strategy);
    } catch (error) {
      console.error('Error deploying strategy:', error);
      alert('Error deploying strategy: ' + error.message);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-6">Strategy Configuration</h2>
      
      {/* Token Pair Selection */}
      <div className="mb-6">
        <label className="block text-blue-200 text-sm font-medium mb-2">
          Token Pair
        </label>
        <select
          value={selectedPair}
          onChange={(e) => {
            setSelectedPair(e.target.value);
            updateConfig('selectedPair', e.target.value);
          }}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TOKEN_PAIRS.map((pair) => (
            <option key={pair.label} value={pair.label} className="bg-gray-800">
              {pair.label}
            </option>
          ))}
        </select>
      </div>

      {/* Strategy Type */}
      <div className="mb-6">
        <label className="block text-blue-200 text-sm font-medium mb-2">
          Strategy Type
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'buy', label: 'Buy Ladder', desc: 'Buy below current price' },
            { value: 'sell', label: 'Sell Ladder', desc: 'Sell above current price' },
            { value: 'both', label: 'Buy & Sell', desc: 'Both sides' }
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => {
                setStrategyType(type.value);
                updateConfig('strategyType', type.value);
              }}
              className={`p-3 rounded-lg border transition-all ${
                strategyType === type.value
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-white/5 border-white/20 text-blue-200 hover:bg-white/10'
              }`}
            >
              <div className="font-medium">{type.label}</div>
              <div className="text-xs opacity-75">{type.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Price Configuration */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-blue-200 text-sm font-medium mb-2">
            Start Price ($)
          </label>
                          <input
                  type="number"
                  value={startPrice}
                  onChange={(e) => {
                    setStartPrice(e.target.value);
                    updateConfig('startPrice', e.target.value);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="3000"
                />
        </div>
        <div>
          <label className="block text-blue-200 text-sm font-medium mb-2">
            Spacing ($)
          </label>
                          <input
                  type="number"
                  value={spacing}
                  onChange={(e) => {
                    setSpacing(e.target.value);
                    updateConfig('spacing', e.target.value);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="50"
                />
        </div>
      </div>

      {/* Order Configuration */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-blue-200 text-sm font-medium mb-2">
            Order Size
          </label>
                          <input
                  type="number"
                  value={orderSize}
                  onChange={(e) => {
                    setOrderSize(e.target.value);
                    updateConfig('orderSize', e.target.value);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.1"
                />
        </div>
        <div>
          <label className="block text-blue-200 text-sm font-medium mb-2">
            Number of Orders
          </label>
                          <input
                  type="number"
                  value={numOrders}
                  onChange={(e) => {
                    setNumOrders(e.target.value);
                    updateConfig('numOrders', e.target.value);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="5"
                />
        </div>
      </div>

      {/* Repost Mode */}
      <div className="mb-6">
        <label className="block text-blue-200 text-sm font-medium mb-2">
          Repost Mode
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'same', label: 'Same Price', desc: 'Repost at same level' },
            { value: 'next', label: 'Next Price', desc: 'Move to next level' },
            { value: 'skip', label: 'Skip', desc: 'Don\'t repost' }
          ].map((mode) => (
            <button
              key={mode.value}
              onClick={() => {
                setRepostMode(mode.value);
                updateConfig('repostMode', mode.value);
              }}
              className={`p-3 rounded-lg border transition-all ${
                repostMode === mode.value
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-white/5 border-white/20 text-blue-200 hover:bg-white/10'
              }`}
            >
              <div className="font-medium">{mode.label}</div>
              <div className="text-xs opacity-75">{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div className="mb-6">
        <label className="block text-blue-200 text-sm font-medium mb-2">
          Budget (ETH)
        </label>
        <input
          type="number"
          value={budget}
          onChange={(e) => {
            setBudget(e.target.value);
            updateConfig('budget', e.target.value);
          }}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="1"
        />
      </div>

      {/* Deploy Button */}
      <button
        onClick={handleDeploy}
        disabled={!isConnected || isDeploying}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg text-lg transition-all duration-200 transform hover:scale-105"
      >
        {isDeploying ? 'Deploying...' : 'Deploy Strategy'}
      </button>
    </div>
  );
} 