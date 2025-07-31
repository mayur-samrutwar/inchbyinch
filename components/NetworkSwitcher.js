import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractService from '../utils/contractService';

export default function NetworkSwitcher({ onNetworkChange }) {
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [supportedNetworks, setSupportedNetworks] = useState([]);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
      // Get supported networks - Sepolia only
  setSupportedNetworks([{ chainId: 11155111, name: 'Sepolia' }]);
  }, []);

  // Check current network when wallet is connected
  useEffect(() => {
    const checkCurrentNetwork = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const network = await provider.getNetwork();
          setCurrentNetwork(network.chainId);
        } catch (error) {
          console.error('Error checking current network:', error);
        }
      }
    };

    checkCurrentNetwork();

    // Listen for network changes
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('chainChanged', (chainId) => {
        setCurrentNetwork(parseInt(chainId, 16));
        if (onNetworkChange) {
          onNetworkChange(parseInt(chainId, 16));
        }
      });
    }

    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, [onNetworkChange]);

  const switchNetwork = async (targetChainId) => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsSwitching(true);

    try {
      // Request network switch
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });

      setCurrentNetwork(targetChainId);
      if (onNetworkChange) {
        onNetworkChange(targetChainId);
      }

    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          // Add the network to MetaMask
          const networkConfig = getNetworkConfig(targetChainId);
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetChainId.toString(16)}`,
              chainName: networkConfig.name,
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: [networkConfig.rpcUrl],
              blockExplorerUrls: [networkConfig.blockExplorer]
            }],
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
          alert('Failed to add network to wallet');
        }
      } else {
        console.error('Error switching network:', switchError);
        alert('Failed to switch network');
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const getNetworkConfig = (chainId) => {
    if (chainId === 11155111) {
      return {
        name: 'Sepolia',
        rpcUrl: 'https://sepolia.infura.io/v3/your-project-id',
        blockExplorer: 'https://sepolia.etherscan.io'
      };
    }
    return null;
  };

  const isCurrentNetworkSupported = () => {
    return supportedNetworks.some(net => net.chainId === currentNetwork);
  };

  const getCurrentNetworkName = () => {
    const network = supportedNetworks.find(net => net.chainId === currentNetwork);
    return network ? network.name : 'Unsupported Network';
  };

  if (!currentNetwork) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span className="text-sm text-gray-500">Checking network...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      {/* Current Network Display */}
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${isCurrentNetworkSupported() ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-sm font-medium text-gray-700">
          {getCurrentNetworkName()}
        </span>
      </div>

      {/* Network Switcher */}
      <div className="relative">
        <select
          value={currentNetwork}
          onChange={(e) => switchNetwork(parseInt(e.target.value))}
          disabled={isSwitching}
          className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {supportedNetworks.map((network) => (
            <option key={network.chainId} value={network.chainId}>
              {network.name}
            </option>
          ))}
        </select>
        
        {isSwitching && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-md">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Warning for unsupported network */}
      {!isCurrentNetworkSupported() && (
        <div className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
          Switch to a supported network
        </div>
      )}
    </div>
  );
} 