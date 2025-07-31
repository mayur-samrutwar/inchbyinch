import Link from 'next/link';
import { useRouter } from 'next/router';
import WalletConnect from './WalletConnect';

export default function Navigation({ onConnect, isConnected, account }) {
  const router = useRouter();

  const isActive = (path) => {
    return router.pathname === path;
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-light text-black">inchbyinch</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors ${
                isActive('/') 
                  ? 'text-black border-b-2 border-black' 
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Deploy Strategy
            </Link>
            <Link 
              href="/dashboard" 
              className={`text-sm font-medium transition-colors ${
                isActive('/dashboard') 
                  ? 'text-black border-b-2 border-black' 
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Dashboard
            </Link>
            <Link 
              href="/docs" 
              className={`text-sm font-medium transition-colors ${
                isActive('/docs') 
                  ? 'text-black border-b-2 border-black' 
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Documentation
            </Link>
            
            {/* Wallet Connect */}
            <WalletConnect 
              onConnect={onConnect}
              isConnected={isConnected}
              account={account}
            />
          </div>
        </div>
      </div>
    </nav>
  );
} 