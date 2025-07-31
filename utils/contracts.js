import { parseEther, formatEther } from 'viem';

// Network configurations
export const NETWORKS = {
  mainnet: {
    id: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    explorer: 'https://etherscan.io',
    chainId: '0x1'
  },
  base: {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    chainId: '0x2105'
  },
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    chainId: '0x14a34'
  },
  sepolia: {
    id: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
    explorer: 'https://sepolia.etherscan.io',
    chainId: '0xaa36a7'
  },
  polygonAmoy: {
    id: 80002,
    name: 'Polygon Amoy',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
    chainId: '0x13881'
  }
};

// Token configurations
export const TOKENS = {
  mainnet: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8C8',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  base: {
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'
  },
  baseSepolia: {
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7c',
    DAI: '0x0000000000000000000000000000000000000000' // Not available on Base Sepolia
  },
  sepolia: {
    WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D574'
  },
  polygonAmoy: {
    WETH: '0x0000000000000000000000000000000000000000', // Not available
    USDC: '0x0000000000000000000000000000000000000000', // Not available
    DAI: '0x0000000000000000000000000000000000000000' // Not available
  }
};

// Contract ABIs
export const CONTRACT_ABIS = {
  factory: require('./abis/inchbyinchFactory.json'),
  bot: require('./abis/inchbyinchBot.json'),
  orderManager: require('./abis/OrderManager.json'),
  oracleAdapter: require('./abis/OracleAdapter.json')
};

// Contract addresses (will be loaded from deployment)
export const CONTRACT_ADDRESSES = {
  mainnet: {
    factory: process.env.NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS || '',
    orderManager: process.env.NEXT_PUBLIC_MAINNET_ORDER_MANAGER_ADDRESS || '',
    oracleAdapter: process.env.NEXT_PUBLIC_MAINNET_ORACLE_ADAPTER_ADDRESS || '',
    lopAdapter: process.env.NEXT_PUBLIC_MAINNET_LOP_ADAPTER_ADDRESS || ''
  },
  base: {
    factory: process.env.NEXT_PUBLIC_BASE_FACTORY_ADDRESS || '',
    orderManager: process.env.NEXT_PUBLIC_BASE_ORDER_MANAGER_ADDRESS || '',
    oracleAdapter: process.env.NEXT_PUBLIC_BASE_ORACLE_ADAPTER_ADDRESS || '',
    lopAdapter: process.env.NEXT_PUBLIC_BASE_LOP_ADAPTER_ADDRESS || ''
  },
  baseSepolia: {
    factory: process.env.NEXT_PUBLIC_BASE_SEPOLIA_FACTORY_ADDRESS || '',
    orderManager: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORDER_MANAGER_ADDRESS || '',
    oracleAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORACLE_ADAPTER_ADDRESS || '',
    lopAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_LOP_ADAPTER_ADDRESS || ''
  },
  sepolia: {
    factory: process.env.NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS || '',
    orderManager: process.env.NEXT_PUBLIC_SEPOLIA_ORDER_MANAGER_ADDRESS || '',
    oracleAdapter: process.env.NEXT_PUBLIC_SEPOLIA_ORACLE_ADAPTER_ADDRESS || '',
    lopAdapter: process.env.NEXT_PUBLIC_SEPOLIA_LOP_ADAPTER_ADDRESS || ''
  },
  polygonAmoy: {
    factory: process.env.NEXT_PUBLIC_POLYGON_AMOY_FACTORY_ADDRESS || '',
    orderManager: process.env.NEXT_PUBLIC_POLYGON_AMOY_ORDER_MANAGER_ADDRESS || '',
    oracleAdapter: process.env.NEXT_PUBLIC_POLYGON_AMOY_ORACLE_ADAPTER_ADDRESS || '',
    lopAdapter: process.env.NEXT_PUBLIC_POLYGON_AMOY_LOP_ADAPTER_ADDRESS || ''
  }
};

// Helper function to get network config
export function getNetworkConfig(chainId) {
  const network = Object.values(NETWORKS).find(net => net.id === chainId);
  return network || NETWORKS.sepolia; // Default to Sepolia
}

// Helper function to get tokens for network
export function getTokensForNetwork(chainId) {
  const network = Object.values(NETWORKS).find(net => net.id === chainId);
  if (!network) return TOKENS.sepolia;
  
  const networkName = Object.keys(NETWORKS).find(key => NETWORKS[key].id === chainId);
  return TOKENS[networkName] || TOKENS.sepolia;
}

// Helper function to get contract addresses for network
export function getContractAddressesForNetwork(chainId) {
  const network = Object.values(NETWORKS).find(net => net.id === chainId);
  if (!network) return CONTRACT_ADDRESSES.sepolia;
  
  const networkName = Object.keys(NETWORKS).find(key => NETWORKS[key].id === chainId);
  return CONTRACT_ADDRESSES[networkName] || CONTRACT_ADDRESSES.sepolia;
}

// Get current network
export function getCurrentNetwork(provider) {
  if (!provider) return null;
  return provider.network?.chainId;
}

// Validate network support
export function isNetworkSupported(chainId) {
  return Object.values(NETWORKS).some(net => net.id === chainId);
}

// Get supported networks
export function getSupportedNetworks() {
  return Object.values(NETWORKS);
}

// Get token configuration
export function getTokenConfig(symbol) {
  const tokens = Object.values(TOKENS).flatMap(network => Object.values(network));
  return tokens.find(token => token.symbol === symbol) || null;
}

// Get all available tokens
export function getAvailableTokens() {
  return Object.values(TOKENS).flatMap(network => Object.values(network));
}

// Create contract instance with Viem
export function createContract(address, abi, walletClient) {
  if (!address || !abi || !walletClient) {
    throw new Error('Invalid contract parameters');
  }
  return {
    address,
    abi,
    walletClient
  };
}

// Create factory contract
export function createFactoryContract(walletClient, networkConfig) {
  return createContract(networkConfig.contracts.factory, CONTRACT_ABIS.factory, walletClient);
}

// Create order manager contract
export function createOrderManagerContract(walletClient, networkConfig) {
  return createContract(networkConfig.contracts.orderManager, CONTRACT_ABIS.orderManager, walletClient);
}

// Create oracle adapter contract
export function createOracleAdapterContract(walletClient, networkConfig) {
  return createContract(networkConfig.contracts.oracleAdapter, CONTRACT_ABIS.oracleAdapter, walletClient);
}

// Create bot contract
export function createBotContract(botAddress, walletClient) {
  return createContract(botAddress, CONTRACT_ABIS.bot, walletClient);
}

// Validate contract addresses
export function validateContractAddresses(networkConfig) {
  const required = ['factory', 'orderManager', 'oracleAdapter', 'lop'];
  const missing = required.filter(key => !networkConfig.contracts[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing contract addresses: ${missing.join(', ')}`);
  }
  
  return true;
}

// Format token amount
export function formatTokenAmount(amount, decimals = 18) {
  return formatEther(amount);
}

// Parse token amount
export function parseTokenAmount(amount, decimals = 18) {
  return parseEther(amount.toString());
}

// Estimate gas with buffer for safe transactions
export async function estimateGasWithBuffer(contract, functionName, args, buffer = 1.2) {
  try {
    // For Viem contracts, we need to simulate the call to estimate gas
    const gasEstimate = await contract.estimateGas({
      functionName,
      args
    });
    
    // Add buffer for safety
    return Math.floor(Number(gasEstimate) * buffer);
  } catch (error) {
    console.error('Error estimating gas:', error);
    // Return a safe default if estimation fails
    return 300000; // 300k gas as fallback
  }
}

// Default export
export default {
  NETWORKS,
  TOKENS,
  CONTRACT_ABIS,
  CONTRACT_ADDRESSES,
  getNetworkConfig,
  getTokensForNetwork,
  getContractAddressesForNetwork,
  getCurrentNetwork,
  isNetworkSupported,
  getSupportedNetworks,
  getTokenConfig,
  getAvailableTokens,
  createContract,
  createFactoryContract,
  createOrderManagerContract,
  createOracleAdapterContract,
  createBotContract,
  validateContractAddresses,
  formatTokenAmount,
  parseTokenAmount,
  estimateGasWithBuffer
}; 