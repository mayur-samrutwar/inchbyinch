import React from 'react';

export default function StrategyPerformance({ performance, strategy }) {
  if (!performance || !strategy) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Performance</h3>
        <div className="text-center text-gray-500">
          No performance data available
        </div>
      </div>
    );
  }

  const {
    totalFilled,
    totalSpent,
    profit,
    profitPercentage
  } = performance;

  const isProfit = parseFloat(profit) >= 0;
  const profitColor = isProfit ? 'text-green-600' : 'text-red-600';
  const profitIcon = isProfit ? '↗' : '↘';

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Performance</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Total Filled:</span>
            <span className="font-medium text-gray-900">
              {parseFloat(totalFilled).toFixed(4)} {strategy.makerAsset === '0x4200000000000000000000000000000000000006' ? 'ETH' : 'Tokens'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Total Spent:</span>
            <span className="font-medium text-gray-900">
              ${parseFloat(totalSpent).toFixed(2)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Profit/Loss:</span>
            <span className={`font-medium ${profitColor} flex items-center`}>
              {profitIcon} ${parseFloat(profit).toFixed(2)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Profit %:</span>
            <span className={`font-medium ${profitColor}`}>
              {parseFloat(profitPercentage).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Strategy Status */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Strategy Status:</span>
            <span className={`font-medium ${strategy.isActive ? 'text-green-600' : 'text-red-600'}`}>
              {strategy.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Strategy Type:</span>
            <span className="font-medium text-gray-900">
              {strategy.strategyType === '0' ? 'Buy Ladder' : 
               strategy.strategyType === '1' ? 'Sell Ladder' : 'Buy + Sell'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Current Orders:</span>
            <span className="font-medium text-gray-900">
              {strategy.currentOrderIndex || '0'}
            </span>
          </div>
          
          {strategy.flipToSell && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">Flip to Sell:</span>
              <span className={`font-medium ${strategy.flipSellActive ? 'text-green-600' : 'text-gray-600'}`}>
                {strategy.flipSellActive ? 'Active' : 'Pending'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Performance Summary</h4>
        <div className="text-sm text-gray-600">
          {isProfit ? (
            <p>Your strategy is currently profitable with a {parseFloat(profitPercentage).toFixed(2)}% return on investment.</p>
          ) : (
            <p>Your strategy is currently at a loss of {parseFloat(profitPercentage).toFixed(2)}%.</p>
          )}
        </div>
      </div>
    </div>
  );
} 