import { fetchPrice, fetchPrices } from '../../utils/priceFeeds';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symbol, symbols } = req.query;

    // Handle single symbol request
    if (symbol) {
      const priceData = await fetchPrice(symbol);
      if (!priceData) {
        return res.status(404).json({ error: `Price not found for ${symbol}` });
      }
      return res.status(200).json(priceData);
    }

    // Handle multiple symbols request
    if (symbols) {
      const symbolArray = Array.isArray(symbols) ? symbols : symbols.split(',');
      const pricesData = await fetchPrices(symbolArray);
      return res.status(200).json(pricesData);
    }

    // Default: return common token prices
    const defaultSymbols = ['ETH', 'USDC', 'USDT', 'WBTC'];
    const pricesData = await fetchPrices(defaultSymbols);
    return res.status(200).json(pricesData);

  } catch (error) {
    console.error('Price API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch prices',
      message: error.message 
    });
  }
} 