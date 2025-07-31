import { useState, useEffect, useCallback } from 'react';

// Cache for price data
const priceCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

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

    if (!response.ok) throw new Error(`API error: ${response.status}`);

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

  const fetchPricesData = useCallback(async (symbolList) => {
    try {
      setLoading(true);
      setError(null);
      
      const priceData = await fetchPrices(symbolList);
      setPrices(priceData);
    } catch (err) {
      console.error('Error fetching prices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPricesData(symbols);
  }, [symbols, fetchPricesData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPricesData(symbols);
    }, 30000);

    return () => clearInterval(interval);
  }, [symbols, fetchPricesData]);

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
    refresh: () => fetchPricesData(symbols)
  };
}

/**
 * Single price hook
 */
export function useSinglePrice(symbol) {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPriceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const priceData = await fetchPrice(symbol);
      if (priceData) {
        setPrice(priceData);
      } else {
        setError('Failed to fetch price');
      }
    } catch (err) {
      console.error(`Error fetching price for ${symbol}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchPriceData();
  }, [symbol, fetchPriceData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPriceData();
    }, 30000);

    return () => clearInterval(interval);
  }, [symbol, fetchPriceData]);

  return {
    price: price?.price || null,
    priceChange24h: price?.change24h || null,
    source: price?.source || null,
    loading,
    error,
    refresh: fetchPriceData
  };
} 