import { useState, useEffect, useCallback } from 'react';
import { useSinglePrice } from '../hooks/usePriceFeed';
import LoadingSpinner from './LoadingSpinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

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
  MIN_SPACING: 1 // 1%
};

const STEPS = [
  { id: 1, title: 'Ladder Configuration', description: 'Price range and order details' },
  { id: 2, title: 'Advanced Settings', description: 'Optional advanced configuration' },
  { id: 3, title: 'Review & Deploy', description: 'Review strategy and deploy' }
];

export default function StrategyForm({ onDeploy, isConnected, onConfigChange }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    selectedPair: 'ETH/USDC',
    strategyType: '', // No default - form will be hidden initially
    startPrice: '3000',
    spacing: '50',
    orderSize: '0.001',
    numOrders: '2',
    postFillBehavior: 'next',
    budget: '8',
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
      errors.push(`Budget too low! You need ${totalSpend.toFixed(2)} USDC but only have ${formData.budget} USDC. Please increase your budget or reduce the number of orders.`);
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
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepIndicator = () => (
    <div className="text-center mb-12">
      <span className="text-white text-lg font-semibold opacity-70 lowercase">{STEPS[currentStep - 1]?.title} ({currentStep}/3)</span>
    </div>
  );

  const renderStep1 = () => (
    <div className="fade-in space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startPrice" className="block text-sm text-gray-300 mb-2 text-left">
            starting price (USDC)
          </Label>
          <input
            type="number"
            id="startPrice"
            value={formData.startPrice}
            onChange={(e) => updateFormData('startPrice', e.target.value)}
            className="input"
            placeholder="3000"
          />
        </div>
        <div>
          <Label htmlFor="spacing" className="block text-sm text-gray-300 mb-2 text-left">
            distance between orders (USDC)
          </Label>
          <input
            type="number"
            id="spacing"
            value={formData.spacing}
            onChange={(e) => updateFormData('spacing', e.target.value)}
            className="input"
            placeholder="50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="orderSize" className="block text-sm text-gray-300 mb-2 text-left">
            order size (ETH)
          </Label>
          <input
            type="number"
            id="orderSize"
            step="0.01"
            value={formData.orderSize}
            onChange={(e) => updateFormData('orderSize', e.target.value)}
            className="input"
            placeholder="0.05"
          />
        </div>
        <div>
          <Label htmlFor="numOrders" className="block text-sm text-gray-300 mb-2 text-left">
            number of orders
          </Label>
          <input
            type="number"
            id="numOrders"
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
        <Label htmlFor="postFillBehavior" className="block text-sm text-gray-300 mb-2 text-left">
          post-fill behavior
        </Label>
        <Select onValueChange={(value) => updateFormData('postFillBehavior', value)} defaultValue={formData.postFillBehavior}>
          <SelectTrigger className="w-1/2 bg-white text-black border-gray-300 focus:border-blue-500 focus:ring-blue-500">
            <SelectValue placeholder="Select a behavior" />
          </SelectTrigger>
          <SelectContent className="bg-white text-black">
            <SelectItem value="next">post at next price level</SelectItem>
            <SelectItem value="same">repost at same price</SelectItem>
            <SelectItem value="skip">skip to next level</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="fade-in space-y-6">
      <div>
        <Label htmlFor="budget" className="block text-sm font-semibold text-white mb-2 text-left">
          budget (USDC)
        </Label>
        <input
          type="number"
          id="budget"
          value={formData.budget}
          onChange={(e) => updateFormData('budget', e.target.value)}
          className="input"
          placeholder="0.2"
        />
        {totalSpend > parseFloat(formData.budget) && (
          <p className="text-red-500 text-xs mt-1">Total spend exceeds budget</p>
        )}
      </div>

      {/* Advanced Settings Toggle */}
      <div className="mt-6 flex items-center space-x-2">
        <Switch
          id="advanced-settings-switch"
          checked={showAdvanced}
          onCheckedChange={(checked) => setShowAdvanced(checked)}
          className="data-[state=checked]:bg-white data-[state=unchecked]:bg-gray-600"
        />
        <Label htmlFor="advanced-settings-switch" className="text-sm text-gray-300">
          advanced settings
        </Label>
      </div>

      {/* Advanced Configuration */}
      {showAdvanced && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxOrders" className="block text-sm text-gray-300 mb-2 text-left">
                max orders posted at once
              </Label>
              <input
                type="number"
                id="maxOrders"
                value={formData.maxOrders}
                onChange={(e) => updateFormData('maxOrders', e.target.value)}
                className="input"
                placeholder="3"
                min="1"
                max="10"
              />
            </div>
            <div>
              <Label htmlFor="cooldownMinutes" className="block text-sm text-gray-300 mb-2 text-left">
                cooldown between fills (minutes)
              </Label>
              <input
                type="number"
                id="cooldownMinutes"
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
              <Label htmlFor="stopLoss" className="block text-sm text-gray-300 mb-2 text-left">
                stop loss (USDC)
              </Label>
              <input
                type="number"
                id="stopLoss"
                value={formData.stopLoss}
                onChange={(e) => updateFormData('stopLoss', e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="takeProfit" className="block text-sm text-gray-300 mb-2 text-left">
                take profit (USDC)
              </Label>
              <input
                type="number"
                id="takeProfit"
                value={formData.takeProfit}
                onChange={(e) => updateFormData('takeProfit', e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="floorPrice" className="block text-sm text-gray-300 mb-2 text-left">
                floor price (USDC)
              </Label>
              <input
                type="number"
                id="floorPrice"
                value={formData.floorPrice}
                onChange={(e) => updateFormData('floorPrice', e.target.value)}
                className="input"
                placeholder="2500"
              />
            </div>
            <div>
              <Label htmlFor="fillPercentage" className="block text-sm text-gray-300 mb-2 text-left">
                fill percentage (%)
              </Label>
              <input
                type="number"
                id="fillPercentage"
                value={formData.fillPercentage}
                onChange={(e) => updateFormData('fillPercentage', e.target.value)}
                className="input"
                placeholder="75"
                min="1"
                max="100"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="flipToSell"
              checked={formData.flipToSell}
              onChange={(e) => updateFormData('flipToSell', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <Label htmlFor="flipToSell" className="text-sm text-gray-300">
              flip to sell after buy
            </Label>
          </div>

          {formData.flipToSell && (
            <div>
              <Label htmlFor="flipPercentage" className="block text-sm text-gray-300 mb-2 text-left">
                flip percentage (%)
              </Label>
              <input
                type="number"
                id="flipPercentage"
                value={formData.flipPercentage}
                onChange={(e) => updateFormData('flipPercentage', e.target.value)}
                className="input"
                placeholder="10"
                min="1"
                max="100"
              />
            </div>
          )}

          <div>
            <Label htmlFor="inactivityHours" className="block text-sm text-gray-300 mb-2 text-left">
              inactivity timeout (hours)
            </Label>
            <input
              type="number"
              id="inactivityHours"
              value={formData.inactivityHours}
              onChange={(e) => updateFormData('inactivityHours', e.target.value)}
              className="input"
              placeholder="6"
              min="1"
              max="168"
            />
          </div>
        </div>
      )}

    </div>
  );

  const renderStep3 = () => (
    <div className="fade-in space-y-6">
      {/* Strategy Preview */}
      <div className="space-y-6">
        
        {/* Ladder Visualization */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">order ladder</h4>
          <div className="space-y-2">
            {Array.from({ length: parseInt(formData.numOrders) || 5 }, (_, i) => {
              const price = parseFloat(formData.startPrice) - (i * parseFloat(formData.spacing));
              return (
                <div key={i} className="flex items-center justify-between p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                    <span className="text-sm font-medium text-white">order {i + 1}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">{price.toFixed(2)} USDC</div>
                    <div className="text-xs text-gray-300">{formData.orderSize} ETH</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strategy Summary */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <h4 className="text-sm font-semibold text-white mb-3">strategy summary</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">token pair:</span>
                <span className="font-medium text-white">{formData.selectedPair}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">strategy type:</span>
                <span className="font-medium text-white capitalize">{formData.strategyType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">total orders:</span>
                <span className="font-medium text-white">{formData.numOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">order size:</span>
                <span className="font-medium text-white">{formData.orderSize} ETH</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">price range:</span>
                <span className="font-medium text-white">{endPrice.toFixed(2)} USDC - {formData.startPrice} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">average price:</span>
                <span className="font-medium text-white">{averagePrice.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">total spend:</span>
                <span className={`font-medium ${totalSpend > parseFloat(formData.budget) ? 'text-red-400' : 'text-white'}`}>
                  {totalSpend.toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">your budget:</span>
                <span className="font-medium text-white">{formData.budget} USDC</span>
              </div>
              {formData.strategyType === 'buy' && (
                <div className="flex justify-between">
                  <span className="text-gray-300">budget status:</span>
                  <span className={`font-medium ${totalSpend > parseFloat(formData.budget) ? 'text-red-400' : 'text-green-400'}`}>
                    {totalSpend > parseFloat(formData.budget) ? 'insufficient' : 'sufficient'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Advanced Configuration Summary */}
        {showAdvanced && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <h3 className="text-sm font-semibold text-white mb-3">advanced configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">max orders:</span>
                  <span className="font-medium text-white">{formData.maxOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">cooldown:</span>
                  <span className="font-medium text-white">{formData.cooldownMinutes} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">floor price:</span>
                  <span className="font-medium text-white">{formData.floorPrice} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">fill percentage:</span>
                  <span className="font-medium text-white">{formData.fillPercentage}%</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">post-fill:</span>
                  <span className="font-medium text-white capitalize">{formData.postFillBehavior}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">flip to sell:</span>
                  <span className="font-medium text-white">{formData.flipToSell ? 'yes' : 'no'}</span>
                </div>
                {formData.flipToSell && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">flip percentage:</span>
                    <span className="font-medium text-white">{formData.flipPercentage}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-300">inactivity timeout:</span>
                  <span className="font-medium text-white">{formData.inactivityHours} hours</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Budget Warning */}
      {totalSpend > parseFloat(formData.budget) && (
        <div className="p-4 bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-xs">
            ⚠️ total spend exceeds budget! please go back and adjust your configuration.
          </p>
        </div>
      )}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      default: return null;
    }
  };

  return (
    <>
      {/* Step Indicator - Outside the box */}
      {formData.strategyType && (
        <div className="text-center mb-6">
          <span className="text-white text-lg font-semibold lowercase">{STEPS[currentStep - 1]?.title} ({currentStep}/3)</span>
        </div>
      )}

      <div className="bg-black rounded-4xl p-8 shadow-lg">
        {/* Strategy Selection - Only show when no strategy is selected */}
        {!formData.strategyType && (
          <div className="mb-8">
            <h2 className="text-white text-sm mb-8 text-center">select the strategy</h2>
            <div className="space-y-2 flex flex-col items-center">
              <button 
                onClick={() => updateFormData('strategyType', 'buy')}
                className={`w-1/2 bg-white text-black text-base font- py-4 px-6 rounded-lg transition-all ${
                  formData.strategyType === 'buy' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                buy range
              </button>
              <button 
                onClick={() => updateFormData('strategyType', 'sell')}
                className={`w-1/2 bg-white text-black font- text-base py-4 px-6 rounded-lg transition-all ${
                  formData.strategyType === 'sell' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                sell range
              </button>
              <button 
                onClick={() => updateFormData('strategyType', 'both')}
                className={`w-1/2 bg-white text-black font- text-base py-4 px-6 rounded-lg transition-all ${
                  formData.strategyType === 'both' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                buy + sell
              </button>
            </div>
          </div>
        )}

        {/* Form Content - Only show after strategy selection */}
        {formData.strategyType && (
          <>
            {renderStepContent()}
            
            <div className="flex justify-between mt-8">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className="btn btn-secondary"
              >
                previous
              </button>
              
              {currentStep < 3 ? (
                <button
                  onClick={nextStep}
                  className="bg-white text-black font-semibold py-2 px-6 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  next
                </button>
              ) : (
                <button
                  onClick={handleDeploy}
                  disabled={!isConnected || isDeploying || totalSpend > parseFloat(formData.budget)}
                  className="bg-white text-black font-semibold py-2 px-6 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeploying ? (
                    <>
                      <LoadingSpinner size="sm" text="" />
                      <span>deploying...</span>
                    </>
                  ) : (
                    'deploy strategy'
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Back to Strategy Selection Button - Outside the box */}
      {formData.strategyType && (
        <div className="mt-4 text-center">
          <button
            onClick={() => updateFormData('strategyType', '')}
            className="text-white text-sm hover:text-gray-300 transition-colors flex items-center space-x-2 mx-auto"
          >
            <span>←</span>
            <span>Back to strategy selection</span>
          </button>
        </div>
      )}
    </>
  );
} 