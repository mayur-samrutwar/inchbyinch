import { useSinglePrice } from '../hooks/usePriceFeed';

export default function PriceDisplay({ symbol, size = 'md', showChange = false, showSource = false }) {
  const { price, loading, error, priceChange24h, source } = useSinglePrice(symbol);

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span className="text-gray-500 text-sm">Loading...</span>
      </div>
    );
  }

  if (error) {
    return <span className="text-red-500 text-sm">Error loading price</span>;
  }

  if (!price) {
    return <span className="text-gray-500 text-sm">Price unavailable</span>;
  }

  const formatPrice = (price) => {
    if (price >= 1000) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(4)}`;
  };

  const formatChange = (change) => {
    if (!change) return null;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const getSizeClasses = (size) => {
    switch (size) {
      case 'xl':
        return 'text-3xl font-bold';
      case 'lg':
        return 'text-2xl font-semibold';
      case 'md':
        return 'text-xl font-semibold';
      case 'sm':
        return 'text-lg font-medium';
      default:
        return 'text-xl font-semibold';
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center space-x-3">
        <span className={`text-gray-900 ${getSizeClasses(size)}`}>
          {formatPrice(price)}
        </span>
        {showChange && priceChange24h && (
          <span className={`text-sm font-medium ${
            priceChange24h > 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {formatChange(priceChange24h)}
          </span>
        )}
      </div>
      
      {showSource && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>via {source}</span>
        </div>
      )}
    </div>
  );
}

export function CompactPriceDisplay({ symbol }) {
  return <PriceDisplay symbol={symbol} size="sm" />;
}

export function PriceTicker({ symbols = ['ETH', 'BTC', 'USDC'] }) {
  return (
    <div className="flex items-center space-x-6">
      {symbols.map((symbol) => (
        <CompactPriceDisplay key={symbol} symbol={symbol} />
      ))}
    </div>
  );
} 