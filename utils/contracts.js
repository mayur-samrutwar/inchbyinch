import { parseEther, formatEther } from 'viem';

// Import ABIs
import factoryABI from './abis/inchbyinchFactory.json';
import botABI from './abis/inchbyinchBot.json';
import orderManagerABI from './abis/OrderManager.json';
import oracleAdapterABI from './abis/OracleAdapter.json';

// Network configuration - Sepolia only
const NETWORK = {
  chainId: 11155111,
  name: 'Sepolia',
  rpcUrl: 'https://sepolia.infura.io/v3/your-project-id',
  blockExplorer: 'https://sepolia.etherscan.io',
  contracts: {
    factory: '0x7DB4A9Cc0BDF94978cC5A2f136465942E69fcc0E',
    orderManager: '0x52339FDdf8bf7dFb2FE1973575B7713314d80Bc4',
    oracleAdapter: '0xA218913B620603788369a49DbDe0283C161dd27C',
    lop: '0x3ef51736315f52d568d6d2cf289419b9cfffe782' // 1inch LOP on Sepolia
  }
};

// Token configuration - ETH/USDC only
const TOKENS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    address: '0x0000000000000000000000000000000000000000', // Native token
    logo: '/tokens/eth.svg'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
    logo: '/tokens/usdc.svg'
  }
};

// Contract ABIs
export const CONTRACT_ABIS = {
  factory: factoryABI.abi,
  bot: botABI.abi,
  orderManager: orderManagerABI.abi,
  oracleAdapter: oracleAdapterABI.abi
};

// Get network configuration
export function getNetworkConfig(chainId) {
  if (chainId !== NETWORK.chainId) {
    throw new Error(`Unsupported network: ${chainId}. Please switch to Sepolia.`);
  }
  return NETWORK;
}

// Get current network
export function getCurrentNetwork(provider) {
  if (!provider) return null;
  return provider.network?.chainId;
}

// Validate network support
export function isNetworkSupported(chainId) {
  return chainId === NETWORK.chainId;
}

// Get supported networks
export function getSupportedNetworks() {
  return [NETWORK];
}

// Get token configuration
export function getTokenConfig(symbol) {
  return TOKENS[symbol] || null;
}

// Get all available tokens
export function getAvailableTokens() {
  return Object.values(TOKENS);
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

// Default export
export default {
  NETWORK,
  TOKENS,
  CONTRACT_ABIS,
  getNetworkConfig,
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