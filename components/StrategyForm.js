import { useState, useEffect } from 'react';

export default function StrategyForm({ onDeploy, isConnected, onConfigChange }) {
  const [selectedPair, setSelectedPair] = useState('ETH/USDC');
  const [startPrice, setStartPrice] = useState('3000');
  const [spacing, setSpacing] = useState('50');
  const [orderSize, setOrderSize] = useState('0.05');
  const [numOrders, setNumOrders] = useState('10');
  const [strategyType, setStrategyType] = useState('buy');
  const [repostMode, setRepostMode] = useState('next');
  const [budget, setBudget] = useState('1500');
  const [isDeploying, setIsDeploying] = useState(false);
  
  // Advanced configuration
  const [maxOrders, setMaxOrders] = useState('3');
  const [cooldownMinutes, setCooldownMinutes] = useState('5');
  const [floorPrice, setFloorPrice] = useState('2500');
  const [stopLoss, setStopLoss] = useState('0');
  const [fillPercentage, setFillPercentage] = useState('75');
  const [postFillBehavior, setPostFillBehavior] = useState('next');
  const [flipToSell, setFlipToSell] = useState(false);
  const [flipPercentage, setFlipPercentage] = useState('10');
  const [inactivityHours, setInactivityHours] = useState('6');

  const TOKEN_PAIRS = [
    { label: 'ETH/USDC', makerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', takerAsset: '0xA0b86a33E6441b8c4C8C1C1C0B8C4C8C1C1C0B8C4' },
    { label: 'WETH/USDC', makerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', takerAsset: '0xA0b86a33E6441b8c4C8C1C1C0B8C4C8C1C1C0B8C4' },
    { label: 'WBTC/ETH', makerAsset: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', takerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' }
  ];

  // Calculate total spend
  const totalSpend = parseFloat(orderSize) * parseFloat(numOrders) * parseFloat(startPrice);
  const endPrice = parseFloat(startPrice) - (parseFloat(numOrders) - 1) * parseFloat(spacing);
  const averagePrice = (parseFloat(startPrice) + endPrice) / 2;

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
      maxOrders,
      cooldownMinutes,
      floorPrice,
      stopLoss,
      fillPercentage,
      postFillBehavior,
      flipToSell,
      flipPercentage,
      inactivityHours,
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

    if (totalSpend > parseFloat(budget)) {
      alert('Total spend exceeds your budget! Please adjust order size or number of orders.');
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
        budget: parseFloat(budget),
        maxOrders: parseInt(maxOrders),
        cooldownMinutes: parseInt(cooldownMinutes),
        floorPrice: parseFloat(floorPrice),
        stopLoss: parseFloat(stopLoss),
        fillPercentage: parseInt(fillPercentage),
        postFillBehavior,
        flipToSell,
        flipPercentage: parseFloat(flipPercentage),
        inactivityHours: parseInt(inactivityHours)
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
            { value: 'buy', label: 'Buy Range', desc: 'Buy below current price' },
            { value: 'sell', label: 'Sell Range', desc: 'Sell above current price' },
            { value: 'both', label: 'Buy + Sell', desc: 'Range-bound ping-pong' }
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
            Starting Price ($)
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
            Distance Between Orders ($)
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
            Order Size (ETH)
          </label>
          <input
            type="number"
            step="0.01"
            value={orderSize}
            onChange={(e) => {
              setOrderSize(e.target.value);
              updateConfig('orderSize', e.target.value);
            }}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.05"
          />
        </div>
        <div>
          <label className="block text-blue-200 text-sm font-medium mb-2">
            Total Buy Levels
          </label>
          <input
            type="number"
            value={numOrders}
            onChange={(e) => {
              setNumOrders(e.target.value);
              updateConfig('numOrders', e.target.value);
            }}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="10"
          />
        </div>
      </div>

      {/* Post-Fill Behavior */}
      <div className="mb-6">
        <label className="block text-blue-200 text-sm font-medium mb-2">
          Post-Fill Behavior
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'next', label: 'Next Level', desc: 'Move to next price level' },
            { value: 'same', label: 'Same Price', desc: 'Repost at same level' },
            { value: 'stop', label: 'Stop', desc: 'Stop after 1 fill' }
          ].map((mode) => (
            <button
              key={mode.value}
              onClick={() => {
                setPostFillBehavior(mode.value);
                updateConfig('postFillBehavior', mode.value);
              }}
              className={`p-3 rounded-lg border transition-all ${
                postFillBehavior === mode.value
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

      {/* Advanced Configuration */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Advanced Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">
              Max Orders Posted at Once
            </label>
            <input
              type="number"
              value={maxOrders}
              onChange={(e) => {
                setMaxOrders(e.target.value);
                updateConfig('maxOrders', e.target.value);
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="3"
            />
          </div>
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">
              Cooldown Between Fills (minutes)
            </label>
            <input
              type="number"
              value={cooldownMinutes}
              onChange={(e) => {
                setCooldownMinutes(e.target.value);
                updateConfig('cooldownMinutes', e.target.value);
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="5"
            />
          </div>
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">
              Floor Price ($)
            </label>
            <input
              type="number"
              value={floorPrice}
              onChange={(e) => {
                setFloorPrice(e.target.value);
                updateConfig('floorPrice', e.target.value);
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="2500"
            />
          </div>
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">
              Fill Percentage to Trigger (%)
            </label>
            <input
              type="number"
              value={fillPercentage}
              onChange={(e) => {
                setFillPercentage(e.target.value);
                updateConfig('fillPercentage', e.target.value);
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="75"
            />
          </div>
        </div>
      </div>

      {/* Flip to Sell Option */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <input
            type="checkbox"
            id="flipToSell"
            checked={flipToSell}
            onChange={(e) => {
              setFlipToSell(e.target.checked);
              updateConfig('flipToSell', e.target.checked);
            }}
            className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
          />
          <label htmlFor="flipToSell" className="text-blue-200 font-medium">
            Flip to SELL at +X% from fill price
          </label>
        </div>
        {flipToSell && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-200 text-sm font-medium mb-2">
                Flip Percentage (%)
              </label>
              <input
                type="number"
                value={flipPercentage}
                onChange={(e) => {
                  setFlipPercentage(e.target.value);
                  updateConfig('flipPercentage', e.target.value);
                }}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10"
              />
            </div>
          </div>
        )}
      </div>

      {/* Safety & Budget Controls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Safety & Budget Controls</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">
              Max Total Spend ($)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => {
                setBudget(e.target.value);
                updateConfig('budget', e.target.value);
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1500"
            />
          </div>
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">
              Cancel All If Inactive (hours)
            </label>
            <input
              type="number"
              value={inactivityHours}
              onChange={(e) => {
                setInactivityHours(e.target.value);
                updateConfig('inactivityHours', e.target.value);
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="6"
            />
          </div>
        </div>
      </div>

      {/* Strategy Summary */}
      <div className="mb-6 bg-white/5 rounded-lg p-4">
        <h3 className="text-white font-bold mb-3">Strategy Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-blue-200">Total Orders:</span>
              <span className="text-white">{numOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">Order Size:</span>
              <span className="text-white">{orderSize} ETH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">Price Range:</span>
              <span className="text-white">${endPrice.toFixed(2)} - ${startPrice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">Average Price:</span>
              <span className="text-white">${averagePrice.toFixed(2)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-blue-200">Total Spend:</span>
              <span className={`font-bold ${totalSpend > parseFloat(budget) ? 'text-red-400' : 'text-white'}`}>
                ${totalSpend.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">Budget:</span>
              <span className="text-white">${budget}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">Post-Fill:</span>
              <span className="text-white capitalize">{postFillBehavior}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">Max Orders:</span>
              <span className="text-white">{maxOrders}</span>
            </div>
          </div>
        </div>
        {totalSpend > parseFloat(budget) && (
          <div className="mt-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
            ⚠️ Total spend exceeds budget! Please adjust order size or number of orders.
          </div>
        )}
      </div>

      {/* Deploy Button */}
      <button
        onClick={handleDeploy}
        disabled={!isConnected || isDeploying || totalSpend > parseFloat(budget)}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg text-lg transition-all duration-200 transform hover:scale-105"
      >
        {isDeploying ? 'Deploying...' : 'Deploy Strategy'}
      </button>
    </div>
  );
} 