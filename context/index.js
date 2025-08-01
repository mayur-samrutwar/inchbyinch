'use client'

import React, { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, cookieToInitialState } from 'wagmi'
import { createAppKit } from '@reown/appkit'
import { config, networks, projectId, wagmiAdapter } from '../config'
import { baseSepolia, mainnet, base, sepolia } from 'wagmi/chains'

const queryClient = new QueryClient()

const metadata = {
  name: 'inchbyinch',
  description: 'Smart ladder trading automation on 1inch LOP',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://inchbyinch.xyz',
  icons: ['https://inchbyinch.xyz/favicon.ico'],
}

export default function ContextProvider({
  children,
  cookies,
}) {
  // Initialize AppKit in useEffect to ensure it only runs on client
  useEffect(() => {
    if (projectId) {
      try {
        createAppKit({
          adapters: [wagmiAdapter],
          projectId: projectId,
          networks: networks,
          defaultNetwork: baseSepolia,
          metadata,
          features: { analytics: true },
        })
      } catch (error) {
        console.error('Failed to initialize AppKit:', error)
      }
    }
  }, [])

  // Calculate initial state for Wagmi SSR hydration
  const initialState = cookieToInitialState(config, cookies)

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
} 