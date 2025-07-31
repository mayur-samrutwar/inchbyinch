// Price feed utilities for inchbyinch
// Supports multiple price sources with fallbacks

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const COINGECKO_IDS = {
  'ETH': 'ethereum',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'WBTC': 'wrapped-bitcoin',
  'DAI': 'dai'
};

// Cache for price data to avoid excessive API calls
const priceCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Fetch price from CoinGecko API
 */
async function fetchCoinGeckPrice(symbol) {
  try {
    const coinId = COINGECKO_IDS[symbol];
    if (!coinId) {
      throw new Error(`Unsupported symbol: ${symbol}`);
    }

    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      price: data[coinId].usd,
      change24h: data[coinId].usd_24h_change,
      source: 'coingecko',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`Error fetching ${symbol} price from CoinGecko:`, error);
    return null;
  }
}

/**
 * Fetch price from alternative API (CoinCap)
 */
async function fetchCoinCapPrice(symbol) {
  try {
    const response = await fetch(`https://api.coincap.io/v2/assets/${symbol.toLowerCase()}`);
    
    if (!response.ok) {
      throw new Error(`CoinCap API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      price: parseFloat(data.data.priceUsd),
      change24h: parseFloat(data.data.changePercent24Hr),
      source: 'coincap',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`Error fetching ${symbol} price from CoinCap:`, error);
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
 * Fetch price with multiple fallbacks
 */
export async function fetchPrice(symbol) {
  // Check cache first
  const cached = getCachedPrice(symbol);
  if (cached) {
    return cached;
  }

  // Try CoinGecko first
  let priceData = await fetchCoinGeckPrice(symbol);
  
  // Fallback to CoinCap if CoinGecko fails
  if (!priceData) {
    priceData = await fetchCoinCapPrice(symbol);
  }

  // If all APIs fail, return null
  if (!priceData) {
    console.error(`Failed to fetch price for ${symbol} from all sources`);
    return null;
  }

  // Cache the result
  setCachedPrice(symbol, priceData);
  return priceData;
}

/**
 * Fetch multiple prices at once
 */
export async function fetchPrices(symbols) {
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
    return `$${numPrice.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  } else {
    return `$${numPrice.toFixed(decimals)}`;
  }
}

/**
 * Get price change color class
 */
export function getPriceChangeColor(change24h) {
  if (!change24h) return 'text-gray-400';
  return change24h >= 0 ? 'text-green-400' : 'text-red-400';
}

/**
 * Format price change percentage
 */
export function formatPriceChange(change24h) {
  if (!change24h) return 'N/A';
  const sign = change24h >= 0 ? '+' : '';
  return `${sign}${change24h.toFixed(2)}%`;
}

/**
 * Get default prices for common pairs
 */
export const DEFAULT_PRICES = {
  'ETH/USDC': 3250,
  'ETH/USDT': 3250,
  'WBTC/ETH': 0.05,
  'ETH/DAI': 3250
}; 