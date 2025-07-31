import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { http } from 'viem';

export const config = getDefaultConfig({
  appName: 'inchbyinch',
  projectId: 'demo', // Using demo project ID for now
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
});

// Contract addresses for Sepolia
export const CONTRACTS = {
  factory: '0x7DB4A9Cc0BDF94978cC5A2f136465942E69fcc0E',
  orderManager: '0x52339FDdf8bf7dFb2FE1973575B7713314d80Bc4',
  oracleAdapter: '0xA218913B620603788369a49DbDe0283C161dd27C',
  lop: '0x3ef51736315f52d568d6d2cf289419b9cfffe782'
};

// Token configuration
export const TOKENS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    address: '0x0000000000000000000000000000000000000000'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  }
}; 