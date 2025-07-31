import { useState } from 'react';
import { ethers } from 'ethers';

export default function WalletConnect({ onConnect, isConnected, account }) {
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Web3 wallet!');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      onConnect(accounts[0], provider, signer);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet: ' + (error.message || 'Unknown error'));
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    onConnect('', null, null);
  };

  if (isConnected) {
    return (
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium text-gray-700">
            {account.slice(0, 6)}...{account.slice(-4)}
          </span>
        </div>
        <button
          onClick={disconnectWallet}
          className="btn btn-ghost text-sm"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="btn btn-primary"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
} 