import { useSinglePrice } from '../hooks/usePriceFeed';

/**
 * Price display component with real-time updates
 */
export default function PriceDisplay({ 
  symbol = 'ETH', 
  showChange = true, 
  showSource = false,
  className = '',
  size = 'lg' // sm, md, lg, xl
}) {
  const { price, change24h, source, loading, error, lastUpdate } = useSinglePrice(symbol);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    
    if (numPrice >= 1000) {
      return `$${numPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      return `$${numPrice.toFixed(2)}`;
    }
  };

  const formatChange = (change) => {
    if (!change) return '';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const getChangeColor = (change) => {
    if (!change) return 'text-gray-400';
    return change >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getSourceColor = (source) => {
    switch (source) {
      case 'coingecko': return 'text-blue-400';
      case 'coincap': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${sizeClasses[size]} font-bold text-white`}>
          Loading...
        </div>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <div className={`${sizeClasses[size]} font-bold text-red-400`}>
          Error loading price
        </div>
        <div className="text-xs text-red-300">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className={`${sizeClasses[size]} font-bold text-white`}>
        {formatPrice(price)}
      </div>
      
      {showChange && change24h !== null && (
        <div className={`text-sm ${getChangeColor(change24h)}`}>
          {formatChange(change24h)}
        </div>
      )}
      
      {showSource && source && (
        <div className={`text-xs ${getSourceColor(source)}`}>
          via {source}
        </div>
      )}
      
      {lastUpdate && (
        <div className="text-xs text-gray-400">
          Updated {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

/**
 * Compact price display for small spaces
 */
export function CompactPriceDisplay({ symbol = 'ETH', className = '' }) {
  const { price, change24h, loading, error } = useSinglePrice(symbol);

  if (loading) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <div className="text-sm text-white">Loading...</div>
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-sm text-red-400 ${className}`}>
        Error
      </div>
    );
  }

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `$${numPrice.toFixed(2)}`;
  };

  const formatChange = (change) => {
    if (!change) return '';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  const getChangeColor = (change) => {
    if (!change) return 'text-gray-400';
    return change >= 0 ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="text-sm font-bold text-white">
        {formatPrice(price)}
      </div>
      {change24h !== null && (
        <div className={`text-xs ${getChangeColor(change24h)}`}>
          {formatChange(change24h)}
        </div>
      )}
    </div>
  );
}

/**
 * Price ticker component for multiple symbols
 */
export function PriceTicker({ symbols = ['ETH', 'USDC'], className = '' }) {
  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {symbols.map((symbol) => (
        <CompactPriceDisplay key={symbol} symbol={symbol} />
      ))}
    </div>
  );
} 