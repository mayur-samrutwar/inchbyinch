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
    factory: process.env.NEXT_PUBLIC_BASE_SEPOLIA_FACTORY_ADDRESS || '0x943d0b36bE3c57FAd833c112e948be94B73F2D6c',
    orderManager: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORDER_MANAGER_ADDRESS || '0x1DBDE29762eFA12CBcdf31436Ad5E38317069C0b',
    oracleAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORACLE_ADAPTER_ADDRESS || '0x11510b4c2032418133df6278a8a1d6fe010AdB2e',
    lopAdapter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_LOP_ADAPTER_ADDRESS || '0xc8963bcaFA836EFbE96751d3A2A2975396866548'
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