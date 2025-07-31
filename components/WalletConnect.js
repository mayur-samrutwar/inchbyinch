import { useState } from 'react';
import { ethers } from 'ethers';

export default function WalletConnect({ onConnect, isConnected, account }) {
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      setIsConnecting(true);
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        onConnect(accounts[0], provider, signer);
      } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('Failed to connect wallet: ' + error.message);
      } finally {
        setIsConnecting(false);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  const disconnectWallet = () => {
    onConnect('', null, null);
  };

  if (isConnected) {
    return (
      <div className="flex items-center space-x-4">
        <div className="bg-gray-100 rounded-lg p-3">
          <p className="text-black font-mono text-sm">
            {account.slice(0, 6)}...{account.slice(-4)}
          </p>
        </div>
        <button
          onClick={disconnectWallet}
          className="bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
      className="bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-8 rounded-lg text-lg transition-colors"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
} 