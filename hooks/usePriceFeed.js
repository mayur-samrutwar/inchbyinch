import { useState, useEffect, useCallback } from 'react';
import { fetchPrice, fetchPrices, formatPrice, getPriceChangeColor, formatPriceChange } from '../utils/priceFeeds';

/**
 * Custom hook for managing price feeds
 */
export function usePriceFeed(symbols = ['ETH']) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch prices for given symbols
  const fetchPricesData = useCallback(async (symbolList) => {
    try {
      setLoading(true);
      setError(null);
      
      const priceData = await fetchPrices(symbolList);
      setPrices(priceData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching prices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch single price
  const fetchSinglePrice = useCallback(async (symbol) => {
    try {
      const priceData = await fetchPrice(symbol);
      if (priceData) {
        setPrices(prev => ({
          ...prev,
          [symbol]: priceData
        }));
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error(`Error fetching price for ${symbol}:`, err);
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

  // Helper functions for components
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

  const getPriceSource = useCallback((symbol) => {
    return prices[symbol]?.source || null;
  }, [prices]);

  const refreshPrices = useCallback(() => {
    fetchPricesData(symbols);
  }, [symbols, fetchPricesData]);

  return {
    prices,
    loading,
    error,
    lastUpdate,
    getPrice,
    getFormattedPrice,
    getPriceChange,
    getFormattedPriceChange,
    getPriceChangeColor,
    getPriceSource,
    refreshPrices,
    fetchSinglePrice
  };
}

/**
 * Hook for single price monitoring
 */
export function useSinglePrice(symbol) {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchPriceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const priceData = await fetchPrice(symbol);
      if (priceData) {
        setPrice(priceData);
        setLastUpdate(new Date());
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

  // Initial fetch
  useEffect(() => {
    fetchPriceData();
  }, [symbol, fetchPriceData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPriceData();
    }, 30000);

    return () => clearInterval(interval);
  }, [symbol, fetchPriceData]);

  return {
    price: price?.price || null,
    change24h: price?.change24h || null,
    source: price?.source || null,
    loading,
    error,
    lastUpdate,
    refresh: fetchPriceData
  };
} 