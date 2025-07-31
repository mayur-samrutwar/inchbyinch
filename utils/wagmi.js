import { http, createConfig } from 'wagmi'
import { base, baseSepolia, mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// Configure chains & providers
export const config = createConfig({
  chains: [mainnet, base, baseSepolia, sepolia],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY'),
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID'),
  },
  connectors: [
    injected(),
    metaMask(),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id' }),
  ],
})

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
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7c' // Base Sepolia USDC
  }
}; 