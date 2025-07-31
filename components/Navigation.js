import Link from 'next/link';
import { useRouter } from 'next/router';
import WalletConnect from './WalletConnect';

export default function Navigation({ onConnect, isConnected, account }) {
  const router = useRouter();

  const isActive = (path) => {
    return router.pathname === path;
  };

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-semibold text-gray-900">inchbyinch</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors ${
                isActive('/') 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Deploy Strategy
            </Link>
            <Link 
              href="/dashboard" 
              className={`text-sm font-medium transition-colors ${
                isActive('/dashboard') 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Dashboard
            </Link>
            <Link 
              href="/docs" 
              className={`text-sm font-medium transition-colors ${
                isActive('/docs') 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Documentation
            </Link>
          </div>
          
          {/* Wallet Connect */}
          <WalletConnect 
            onConnect={onConnect}
            isConnected={isConnected}
            account={account}
          />
        </div>
      </div>
    </nav>
  );
} 