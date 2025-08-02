import { useChainId } from 'wagmi';

// Contract addresses for different networks
const CONTRACT_ADDRESSES = {
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
    factory: process.env.NEXT_PUBLIC_BASE_SEPOLIA_FACTORY_ADDRESS || '0x568BCfe4D946504b66d0C025854625733c13AF48',
    orderManager: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORDER_MANAGER_ADDRESS || '0xE1d570B883590e9e7608461858Cd574Cbe1b6CFc',
    oracleAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORACLE_ADAPTER_ADDRESS || '0xB8652C63eafa5E5aE20B32e8A2A3483c7f40ad2A',
    lopAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_LOP_ADAPTER_ADDRESS || '0xE61B109A32EB2afB6Ed6F728cE3c3626C4a2cFf3'
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

export function useContractAddresses() {
  const chainId = useChainId();
  
  console.log('useContractAddresses - Chain ID:', chainId);
  console.log('Environment variables:', {
    factory: process.env.NEXT_PUBLIC_BASE_SEPOLIA_FACTORY_ADDRESS,
    orderManager: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORDER_MANAGER_ADDRESS,
    oracleAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORACLE_ADAPTER_ADDRESS,
    lopAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_LOP_ADAPTER_ADDRESS
  });
  
  const getContractAddresses = () => {
    switch (chainId) {
      case 1: // mainnet
        return CONTRACT_ADDRESSES.mainnet;
      case 8453: // base
        return CONTRACT_ADDRESSES.base;
      case 84532: // baseSepolia
        return CONTRACT_ADDRESSES.baseSepolia;
      case 11155111: // sepolia
        return CONTRACT_ADDRESSES.sepolia;
      case 80002: // polygonAmoy
        return CONTRACT_ADDRESSES.polygonAmoy;
      default:
        return CONTRACT_ADDRESSES.baseSepolia; // Default to Base Sepolia
    }
  };

  const addresses = getContractAddresses();
  console.log('Contract addresses for chain', chainId, ':', addresses);
  
  return addresses;
} 