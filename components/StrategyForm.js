import { useState, useEffect, useCallback } from 'react';
import { useSinglePrice } from '../hooks/usePriceFeed';

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
    budget: '1500',
    // Advanced options
    maxOrders: '3',
    cooldownMinutes: '5',
    floorPrice: '2500',
    stopLoss: '0',
    fillPercentage: '75',
    flipToSell: false,
    flipPercentage: '10',
    inactivityHours: '6'
  });

  const [isDeploying, setIsDeploying] = useState(false);

  // Get real ETH price
  const { price: ethPrice } = useSinglePrice('ETH');

  const TOKEN_PAIRS = [
    { label: 'ETH/USDC', value: 'ETH/USDC' },
    { label: 'WETH/USDC', value: 'WETH/USDC' },
    { label: 'WBTC/ETH', value: 'WBTC/ETH' }
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
  const totalSpend = parseFloat(formData.orderSize) * parseFloat(formData.numOrders) * parseFloat(formData.startPrice);
  const endPrice = parseFloat(formData.startPrice) - (parseFloat(formData.numOrders) - 1) * parseFloat(formData.spacing);
  const averagePrice = (parseFloat(formData.startPrice) + endPrice) / 2;

  const handleDeploy = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    if (totalSpend > parseFloat(formData.budget)) {
      alert('Total spend exceeds your budget! Please adjust order size or number of orders.');
      return;
    }

    setIsDeploying(true);
    try {
      await onDeploy(formData);
    } catch (error) {
      console.error('Error deploying strategy:', error);
      alert('Error deploying strategy: ' + error.message);
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
          placeholder="1500"
        />
        {totalSpend > parseFloat(formData.budget) && (
          <p className="text-red-500 text-xs mt-1">Total spend exceeds budget</p>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="fade-in space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Token Pair:</span>
              <span className="font-medium">{formData.selectedPair}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Strategy Type:</span>
              <span className="font-medium capitalize">{formData.strategyType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Orders:</span>
              <span className="font-medium">{formData.numOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Order Size:</span>
              <span className="font-medium">{formData.orderSize} ETH</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Price Range:</span>
              <span className="font-medium">${endPrice.toFixed(2)} - ${formData.startPrice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Average Price:</span>
              <span className="font-medium">${averagePrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Spend:</span>
              <span className={`font-medium ${totalSpend > parseFloat(formData.budget) ? 'text-red-500' : ''}`}>
                ${totalSpend.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Budget:</span>
              <span className="font-medium">${formData.budget}</span>
            </div>
          </div>
        </div>
      </div>

      {totalSpend > parseFloat(formData.budget) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">
            ⚠️ Total spend exceeds budget! Please go back and adjust your configuration.
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
            className="btn btn-primary"
          >
            {isDeploying ? 'Deploying...' : 'Deploy Strategy'}
          </button>
        )}
      </div>
    </div>
  );
} 