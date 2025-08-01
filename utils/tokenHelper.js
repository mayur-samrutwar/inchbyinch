import { parseUnits, formatUnits } from 'viem';

// Token addresses for Base Sepolia
export const TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x036cbd53842c5426634e7929541ec2318f3dcf7e' // Real Base Sepolia USDC
};

// ERC20 ABI for balance checking
export const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

/**
 * Check if user has sufficient balance for a strategy
 * @param {Object} publicClient - Viem public client
 * @param {string} userAddress - User's wallet address
 * @param {number} strategyType - 0=buy, 1=sell, 2=both
 * @param {string} budget - Budget amount in USD
 * @returns {Object} Balance check result
 */
export async function checkStrategyBalance(publicClient, userAddress, strategyType, budget) {
  try {
    let tokenAddress, decimals, tokenSymbol;
    
    if (strategyType === 0 || strategyType === 2) {
      // BUY_LADDER or BUY_SELL - need USDC
      tokenAddress = TOKENS.USDC;
      decimals = 6;
      tokenSymbol = 'USDC';
    } else {
      // SELL_LADDER - need ETH
      tokenAddress = TOKENS.WETH;
      decimals = 18;
      tokenSymbol = 'ETH';
    }
    
    // Convert budget to token units
    const budgetInTokens = parseUnits(budget, decimals);
    
    // Check user's balance
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress]
    });
    
    const balanceFormatted = formatUnits(balance, decimals);
    const budgetFormatted = formatUnits(budgetInTokens, decimals);
    const hasSufficientBalance = balance >= budgetInTokens;
    
    return {
      hasSufficientBalance,
      balance: balance.toString(),
      balanceFormatted,
      budget: budgetInTokens.toString(),
      budgetFormatted,
      tokenSymbol,
      tokenAddress
    };
    
  } catch (error) {
    console.error('Error checking strategy balance:', error);
    throw new Error(`Failed to check balance: ${error.message}`);
  }
}

/**
 * Format token amount for display
 * @param {string} amount - Amount in wei
 * @param {number} decimals - Token decimals
 * @returns {string} Formatted amount
 */
export function formatTokenAmount(amount, decimals) {
  try {
    return formatUnits(BigInt(amount), decimals);
  } catch (error) {
    return '0';
  }
}

/**
 * Get token info for a strategy type
 * @param {number} strategyType - 0=buy, 1=sell, 2=both
 * @returns {Object} Token info
 */
export function getTokenInfo(strategyType) {
  if (strategyType === 0 || strategyType === 2) {
    return {
      address: TOKENS.USDC,
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin'
    };
  } else {
    return {
      address: TOKENS.WETH,
      symbol: 'ETH',
      decimals: 18,
      name: 'Wrapped Ether'
    };
  }
} 