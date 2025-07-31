import { useState, useEffect, useCallback } from 'react';

// Cache for price data
const priceCache = new Map();
const CACHE_DURATION = 60000; // 60 seconds (increased to reduce API calls)
const REFRESH_INTERVAL = 120000; // 2 minutes (increased to reduce API calls)

/**
 * Fetch price from CoinGecko API
 */
async function fetchCoinGeckoPrice(symbol) {
  if (typeof window === 'undefined') return null;

  try {
    const coinIds = {
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      
      'USDT': 'tether',
      'WBTC': 'wrapped-bitcoin',
      'DAI': 'dai'
    };

    const coinId = coinIds[symbol];
    if (!coinId) throw new Error(`Unsupported symbol: ${symbol}`);

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('CoinGecko rate limit reached, using cached data');
        return null; // Return null to use cached data
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      price: data[coinId].usd,
      change24h: data[coinId].usd_24h_change,
      source: 'coingecko',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`Error fetching ${symbol} price:`, error);
    return null;
  }
}

/**
 * Get cached price or fetch new one
 */
function getCachedPrice(symbol) {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }
  return null;
}

/**
 * Set price in cache
 */
function setCachedPrice(symbol, priceData) {
  priceCache.set(symbol, priceData);
}

/**
 * Fetch price with caching
 */
export async function fetchPrice(symbol) {
  if (typeof window === 'undefined') return null;

  // Check cache first
  const cached = getCachedPrice(symbol);
  if (cached) return cached;

  // Fetch new price
  const priceData = await fetchCoinGeckoPrice(symbol);
  if (priceData) {
    setCachedPrice(symbol, priceData);
  }
  
  return priceData;
}

/**
 * Fetch multiple prices
 */
export async function fetchPrices(symbols) {
  if (typeof window === 'undefined') return {};

  const promises = symbols.map(symbol => fetchPrice(symbol));
  const results = await Promise.allSettled(promises);
  
  const prices = {};
  symbols.forEach((symbol, index) => {
    if (results[index].status === 'fulfilled' && results[index].value) {
      prices[symbol] = results[index].value;
    }
  });
  
  return prices;
}

/**
 * Format price for display
 */
export function formatPrice(price, decimals = 2) {
  if (!price) return 'N/A';
  
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (numPrice >= 1000) {
    return `$${numPrice.toLocaleString('en-US', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    })}`;
  } else {
    return `$${numPrice.toFixed(decimals)}`;
  }
}

/**
 * Format price change
 */
export function formatPriceChange(change24h) {
  if (!change24h) return 'N/A';
  const sign = change24h >= 0 ? '+' : '';
  return `${sign}${change24h.toFixed(2)}%`;
}

/**
 * Get price change color
 */
export function getPriceChangeColor(change24h) {
  if (!change24h) return 'text-gray-400';
  return change24h >= 0 ? 'text-green-500' : 'text-red-500';
}

/**
 * Main price feed hook
 */
export function usePriceFeed(symbols = ['ETH']) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial fetch and auto-refresh
  useEffect(() => {
    let mounted = true;

    const fetchPricesData = async () => {
      if (!mounted) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const priceData = await fetchPrices(symbols);
        
        if (!mounted) return;
        
        // Only update prices if we got some data
        if (Object.keys(priceData).length > 0) {
          setPrices(priceData);
        } else {
          // If no new data, keep existing prices and don't set error
          console.log('No new price data available, keeping existing prices');
        }
      } catch (err) {
        if (!mounted) return;
        
        console.error('Error fetching prices:', err);
        // Don't set error for rate limiting - just log it
        if (!err.message.includes('429')) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchPricesData();

    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchPricesData, REFRESH_INTERVAL);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbols]);

  const getPrice = useCallback((symbol) => {
    return prices[symbol]?.price || null;
  }, [prices]);

  const getFormattedPrice = useCallback((symbol, decimals = 2) => {
    const price = getPrice(symbol);
    return formatPrice(price, decimals);
  }, [getPrice]);

  const getPriceChange = useCallback((symbol) => {
    return prices[symbol]?.change24h || null;
  }, [prices]);

  const getFormattedPriceChange = useCallback((symbol) => {
    const change = getPriceChange(symbol);
    return formatPriceChange(change);
  }, [getPriceChange]);

  const getPriceChangeColor = useCallback((symbol) => {
    const change = getPriceChange(symbol);
    return getPriceChangeColor(change);
  }, [getPriceChange]);

  return {
    prices,
    loading,
    error,
    getPrice,
    getFormattedPrice,
    getPriceChange,
    getFormattedPriceChange,
    getPriceChangeColor,
    refresh: () => {
      // Trigger a manual refresh by calling fetchPrices directly
      fetchPrices(symbols).then(priceData => {
        if (Object.keys(priceData).length > 0) {
          setPrices(priceData);
        }
      }).catch(err => {
        console.error('Manual refresh error:', err);
      });
    }
  };
}

/**
 * Single price hook
 */
export function useSinglePrice(symbol) {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchPriceData = async () => {
      if (!mounted) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const priceData = await fetchPrice(symbol);
        
        if (!mounted) return;
        
        if (priceData) {
          setPrice(priceData);
        } else {
          // Don't set error if no data - might be rate limited
          console.log(`No price data available for ${symbol}`);
        }
      } catch (err) {
        if (!mounted) return;
        
        console.error(`Error fetching price for ${symbol}:`, err);
        // Don't set error for rate limiting
        if (!err.message.includes('429')) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchPriceData();

    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchPriceData, REFRESH_INTERVAL);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  return {
    price: price?.price || null,
    priceChange24h: price?.change24h || null,
    source: price?.source || null,
    loading,
    error,
    refresh: () => {
      // Trigger a manual refresh by calling fetchPrice directly
      fetchPrice(symbol).then(priceData => {
        if (priceData) {
          setPrice(priceData);
        }
      }).catch(err => {
        console.error('Manual refresh error:', err);
      });
    }
  };
} 