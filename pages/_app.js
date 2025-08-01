import "../styles/globals.css";
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '../utils/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  // Only log in development to avoid console spam
  if (process.env.NODE_ENV === 'development') {
    console.log('App config:', config);
    console.log('Environment variables:', {
      MAINNET_RPC_URL: process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
      BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
      BASE_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
      SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
      WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    });
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          chains={config.chains}
          initialChain={config.chains[0]}
        >
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 