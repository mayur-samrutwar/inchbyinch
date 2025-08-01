import { useState, useEffect, useCallback } from 'react';
import { useSinglePrice } from '../hooks/usePriceFeed';
import LoadingSpinner from './LoadingSpinner';

// Contract constants - match the contract values
const STRATEGY_TYPES = {
  BUY_LADDER: 0,
  SELL_LADDER: 1,
  BUY_SELL: 2
};

const REPOST_MODES = {
  NEXT_PRICE: 0,
  SAME_PRICE: 1,
  SKIP: 2
};

const CONTRACT_LIMITS = {
  MAX_ORDERS: 50,
  MAX_ORDER_SIZE: 1000, // 1000 ETH
  MIN_ORDER_SIZE: 0.001, // 0.001 ETH
  MAX_SPACING: 1000, // 1000%
  MIN_SPACING: 1, // 1%
  MAX_BOTS_PER_USER: 10
};

const STEPS = [
  { id: 1, title: 'Basic Setup', description: 'Token pair and strategy type' },
  { id: 2, title: 'Order Configuration', description: 'Price range and order details' },
  { id: 3, title: 'Advanced Settings', description: 'Optional advanced configuration' },
  { id: 4, title: 'Review & Deploy', description: 'Review strategy and deploy' }
];

export default function StrategyForm({ onDeploy, isConnected, onConfigChange }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    selectedPair: 'ETH/USDC',
    strategyType: 'buy',
    startPrice: '3000',
    spacing: '50',
    orderSize: '0.05',
    numOrders: '10',
    postFillBehavior: 'next',
    budget: '0.2',
    // Advanced options
    maxOrders: '3',
    cooldownMinutes: '5',
    floorPrice: '2500',
    stopLoss: '0',
    takeProfit: '0',
    fillPercentage: '75',
    flipToSell: false,
    flipPercentage: '10',
    inactivityHours: '6'
  });

  const [isDeploying, setIsDeploying] = useState(false);

  // Get real ETH price
  const { price: ethPrice } = useSinglePrice('ETH');

  const TOKEN_PAIRS = [
    { label: 'ETH/USDC', value: 'ETH/USDC' }
  ];

  // Update form data
  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Update preview when form changes
  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(formData);
    }
  }, [formData, onConfigChange]);

  // Update start price when ETH price changes
  useEffect(() => {
    if (ethPrice && formData.selectedPair.includes('ETH')) {
      const newStartPrice = Math.round(ethPrice).toString();
      updateFormData('startPrice', newStartPrice);
    }
  }, [ethPrice, formData.selectedPair, updateFormData]);

  // Calculate totals
  const orderSize = parseFloat(formData.orderSize);
  const numOrders = parseInt(formData.numOrders);
  const startPrice = parseFloat(formData.startPrice);
  const spacing = parseFloat(formData.spacing);
  
  // Calculate actual budget needed for BUY strategy
  let totalSpend;
  if (formData.strategyType === 'buy') {
    // For BUY strategy, calculate total cost of all orders
    let totalCost = 0;
    for (let i = 0; i < numOrders; i++) {
      const orderPrice = startPrice - (i * spacing);
      const orderCost = orderSize * orderPrice;
      totalCost += orderCost;
    }
    totalSpend = totalCost;
  } else {
    // For SELL strategy, use budget as provided
    totalSpend = parseFloat(formData.budget);
  }
  
  const endPrice = startPrice - (numOrders - 1) * spacing;
  const averagePrice = (startPrice + endPrice) / 2;

  // Validate form data according to contract limits
  const validateFormData = () => {
    const errors = [];

    // Validate order size
    if (orderSize < CONTRACT_LIMITS.MIN_ORDER_SIZE) {
      errors.push(`Order size too small! Minimum is ${CONTRACT_LIMITS.MIN_ORDER_SIZE} ETH.`);
    }
    
    if (orderSize > CONTRACT_LIMITS.MAX_ORDER_SIZE) {
      errors.push(`Order size too large! Maximum is ${CONTRACT_LIMITS.MAX_ORDER_SIZE} ETH.`);
    }
    
    // Validate spacing
    if (spacing < CONTRACT_LIMITS.MIN_SPACING || spacing > CONTRACT_LIMITS.MAX_SPACING) {
      errors.push(`Invalid spacing! Must be between ${CONTRACT_LIMITS.MIN_SPACING}% and ${CONTRACT_LIMITS.MAX_SPACING}%.`);
    }
    
    // Validate number of orders
    if (numOrders < 1 || numOrders > CONTRACT_LIMITS.MAX_ORDERS) {
      errors.push(`Invalid number of orders! Must be between 1 and ${CONTRACT_LIMITS.MAX_ORDERS}.`);
    }
    
    // Validate budget for BUY strategy
    if (formData.strategyType === 'buy' && parseFloat(formData.budget) < totalSpend) {
      errors.push(`Budget too low! You need $${totalSpend.toFixed(2)} but only have $${formData.budget}. Please increase your budget or reduce the number of orders.`);
    }
    
    // Validate flip percentage
    if (formData.flipToSell && (parseInt(formData.flipPercentage) < 1 || parseInt(formData.flipPercentage) > 50)) {
      errors.push('Flip percentage must be between 1% and 50%.');
    }
    
    // Validate stop loss and take profit
    if (parseFloat(formData.stopLoss) > 0) {
      if (formData.strategyType === 'buy' && parseFloat(formData.stopLoss) >= startPrice) {
        errors.push('Stop loss must be below the start price for buy strategies.');
      }
      if (formData.strategyType === 'sell' && parseFloat(formData.stopLoss) <= startPrice) {
        errors.push('Stop loss must be above the start price for sell strategies.');
      }
    }
    
    if (parseFloat(formData.takeProfit) > 0) {
      if (formData.strategyType === 'buy' && parseFloat(formData.takeProfit) <= startPrice) {
        errors.push('Take profit must be above the start price for buy strategies.');
      }
      if (formData.strategyType === 'sell' && parseFloat(formData.takeProfit) >= startPrice) {
        errors.push('Take profit must be below the start price for sell strategies.');
      }
    }

    return errors;
  };

  const handleDeploy = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    // Validate parameters before deployment
    const validationErrors = validateFormData();
    if (validationErrors.length > 0) {
      alert('Validation errors:\n' + validationErrors.join('\n'));
      return;
    }

    setIsDeploying(true);
    try {
      // Convert form data to contract parameters
      const contractParams = {
        // Strategy type mapping
        strategyType: formData.strategyType === 'buy' ? STRATEGY_TYPES.BUY_LADDER : 
                     formData.strategyType === 'sell' ? STRATEGY_TYPES.SELL_LADDER : 
                     STRATEGY_TYPES.BUY_SELL,
        
        // Repost mode mapping
        repostMode: formData.postFillBehavior === 'next' ? REPOST_MODES.NEXT_PRICE :
                   formData.postFillBehavior === 'same' ? REPOST_MODES.SAME_PRICE :
                   REPOST_MODES.SKIP,
        
        // Price parameters (will be converted to wei in contract service)
        startPrice: formData.startPrice,
        spacing: formData.spacing, // Keep as percentage
        orderSize: formData.orderSize,
        numOrders: parseInt(formData.numOrders),
        
        // Budget (will be converted to appropriate decimals in contract service)
        budget: formData.strategyType === 'buy' ? totalSpend.toFixed(2) : formData.budget,
        
        // Stop conditions
        stopLoss: parseFloat(formData.stopLoss) > 0 ? formData.stopLoss : '0',
        takeProfit: parseFloat(formData.takeProfit) > 0 ? formData.takeProfit : '0',
        
        // Expiry time (convert hours to Unix timestamp)
        expiryTime: parseInt(formData.inactivityHours || '6'),
        
        // Flip settings
        flipToSell: formData.flipToSell || false,
        flipPercentage: parseInt(formData.flipPercentage || '0')
      };

      await onDeploy(contractParams);
      alert('Strategy deployed successfully!');
    } catch (error) {
      console.error('Error deploying strategy:', error);
      alert('Failed to deploy strategy: ' + error.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepIndicator = () => (
    <div className="step-indicator">
      {STEPS.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`step ${
            currentStep === step.id ? 'step-active' : 
            currentStep > step.id ? 'step-completed' : 'step-inactive'
          }`}>
            <div className="step-number">{step.id}</div>
            <span className="hidden sm:inline">{step.title}</span>
          </div>
          {index < STEPS.length - 1 && <div className="step-divider"></div>}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Token Pair</h3>
        <select
          value={formData.selectedPair}
          onChange={(e) => updateFormData('selectedPair', e.target.value)}
          className="select"
        >
          {TOKEN_PAIRS.map((pair) => (
            <option key={pair.value} value={pair.value}>
              {pair.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: 'buy', label: 'Buy Range', desc: 'Buy below current price' },
            { value: 'sell', label: 'Sell Range', desc: 'Sell above current price' },
            { value: 'both', label: 'Buy + Sell', desc: 'Range-bound ping-pong' }
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => updateFormData('strategyType', type.value)}
              className={`p-4 rounded-lg border transition-all text-left ${
                formData.strategyType === type.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{type.label}</div>
              <div className="text-sm text-gray-500">{type.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="fade-in space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Starting Price ($)
          </label>
          <input
            type="number"
            value={formData.startPrice}
            onChange={(e) => updateFormData('startPrice', e.target.value)}
            className="input"
            placeholder="3000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Distance Between Orders ($)
          </label>
          <input
            type="number"
            value={formData.spacing}
            onChange={(e) => updateFormData('spacing', e.target.value)}
            className="input"
            placeholder="50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order Size (ETH)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.orderSize}
            onChange={(e) => updateFormData('orderSize', e.target.value)}
            className="input"
            placeholder="0.05"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Orders
          </label>
          <input
            type="number"
            value={formData.numOrders}
            onChange={(e) => updateFormData('numOrders', e.target.value)}
            className="input"
            placeholder="10"
            min="1"
            max="50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Post-Fill Behavior
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: 'next', label: 'Next Level', desc: 'Move to next price level' },
            { value: 'same', label: 'Same Price', desc: 'Repost at same level' },
            { value: 'stop', label: 'Stop', desc: 'Stop after 1 fill' }
          ].map((mode) => (
            <button
              key={mode.value}
              onClick={() => updateFormData('postFillBehavior', mode.value)}
              className={`p-4 rounded-lg border transition-all text-left ${
                formData.postFillBehavior === mode.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{mode.label}</div>
              <div className="text-sm text-gray-500">{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Advanced Configuration</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="btn btn-ghost text-sm"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Orders Posted at Once
              </label>
              <input
                type="number"
                value={formData.maxOrders}
                onChange={(e) => updateFormData('maxOrders', e.target.value)}
                className="input"
                placeholder="3"
                min="1"
                max="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cooldown Between Fills (minutes)
              </label>
              <input
                type="number"
                value={formData.cooldownMinutes}
                onChange={(e) => updateFormData('cooldownMinutes', e.target.value)}
                className="input"
                placeholder="5"
                min="1"
                max="60"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stop Loss ($)
              </label>
              <input
                type="number"
                value={formData.stopLoss}
                onChange={(e) => updateFormData('stopLoss', e.target.value)}
                className="input"
                placeholder="0 (optional)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Take Profit ($)
              </label>
              <input
                type="number"
                value={formData.takeProfit}
                onChange={(e) => updateFormData('takeProfit', e.target.value)}
                className="input"
                placeholder="0 (optional)"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Floor Price ($)
              </label>
              <input
                type="number"
                value={formData.floorPrice}
                onChange={(e) => updateFormData('floorPrice', e.target.value)}
                className="input"
                placeholder="2500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fill Percentage (%)
              </label>
              <input
                type="number"
                value={formData.fillPercentage}
                onChange={(e) => updateFormData('fillPercentage', e.target.value)}
                className="input"
                placeholder="75"
                min="1"
                max="100"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="flipToSell"
              checked={formData.flipToSell}
              onChange={(e) => updateFormData('flipToSell', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="flipToSell" className="text-sm font-medium text-gray-700">
              Flip to Sell after Buy
            </label>
          </div>

          {formData.flipToSell && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Flip Percentage (%)
              </label>
              <input
                type="number"
                value={formData.flipPercentage}
                onChange={(e) => updateFormData('flipPercentage', e.target.value)}
                className="input"
                placeholder="10"
                min="1"
                max="50"
              />
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Budget ($)
        </label>
        <input
          type="number"
          value={formData.budget}
          onChange={(e) => updateFormData('budget', e.target.value)}
          className="input"
          placeholder="0.2"
        />
        {totalSpend > parseFloat(formData.budget) && (
          <p className="text-red-500 text-xs mt-1">Total spend exceeds budget</p>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="fade-in space-y-6">
      {/* Strategy Preview */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Preview</h3>
        
        {/* Ladder Visualization */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Order Ladder</h4>
          <div className="space-y-2">
            {Array.from({ length: parseInt(formData.numOrders) || 5 }, (_, i) => {
              const price = parseFloat(formData.startPrice) - (i * parseFloat(formData.spacing));
              return (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium text-gray-900">Order {i + 1}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">${price.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{formData.orderSize} ETH</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strategy Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Strategy Summary</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Token Pair:</span>
                <span className="font-medium text-gray-900">{formData.selectedPair}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Strategy Type:</span>
                <span className="font-medium text-gray-900 capitalize">{formData.strategyType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Orders:</span>
                <span className="font-medium text-gray-900">{formData.numOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Order Size:</span>
                <span className="font-medium text-gray-900">{formData.orderSize} ETH</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Price Range:</span>
                <span className="font-medium text-gray-900">${endPrice.toFixed(2)} - ${formData.startPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average Price:</span>
                <span className="font-medium text-gray-900">${averagePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Spend:</span>
                <span className={`font-medium ${totalSpend > parseFloat(formData.budget) ? 'text-red-500' : 'text-gray-900'}`}>
                  ${totalSpend.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Your Budget:</span>
                <span className="font-medium text-gray-900">${formData.budget}</span>
              </div>
              {formData.strategyType === 'buy' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Budget Status:</span>
                  <span className={`font-medium ${totalSpend > parseFloat(formData.budget) ? 'text-red-500' : 'text-green-600'}`}>
                    {totalSpend > parseFloat(formData.budget) ? 'Insufficient' : 'Sufficient'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Configuration Summary */}
      {showAdvanced && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Configuration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Max Orders:</span>
                <span className="font-medium text-gray-900">{formData.maxOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cooldown:</span>
                <span className="font-medium text-gray-900">{formData.cooldownMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Floor Price:</span>
                <span className="font-medium text-gray-900">${formData.floorPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fill Percentage:</span>
                <span className="font-medium text-gray-900">{formData.fillPercentage}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Post-Fill:</span>
                <span className="font-medium text-gray-900 capitalize">{formData.postFillBehavior}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Flip to Sell:</span>
                <span className="font-medium text-gray-900">{formData.flipToSell ? 'Yes' : 'No'}</span>
              </div>
              {formData.flipToSell && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Flip Percentage:</span>
                  <span className="font-medium text-gray-900">{formData.flipPercentage}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Inactivity Timeout:</span>
                <span className="font-medium text-gray-900">{formData.inactivityHours} hours</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Warning */}
      {totalSpend > parseFloat(formData.budget) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">
            ⚠️ Total spend exceeds budget! Please go back and adjust your configuration.
          </p>
        </div>
      )}

      {/* Deployment Confirmation */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Ready to Deploy</h4>
        <p className="text-blue-800 text-sm">
          Your strategy is configured and ready to be deployed onchain. 
          This will create a smart contract that will automatically manage your ladder orders.
        </p>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  return (
    <div className="card p-8">
      {renderStepIndicator()}
      
      {renderStepContent()}
      
      <div className="flex justify-between mt-8">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className="btn btn-secondary"
        >
          Previous
        </button>
        
        {currentStep < STEPS.length ? (
          <button
            onClick={nextStep}
            className="btn btn-primary"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleDeploy}
            disabled={!isConnected || isDeploying || totalSpend > parseFloat(formData.budget)}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            {isDeploying ? (
              <>
                <LoadingSpinner size="sm" text="" />
                <span>Deploying...</span>
              </>
            ) : (
              'Deploy Strategy'
            )}
          </button>
        )}
      </div>
    </div>
  );
} 