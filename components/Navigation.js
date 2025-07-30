import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navigation() {
  const router = useRouter();

  const isActive = (path) => {
    return router.pathname === path;
  };

  return (
    <nav className="bg-white/10 backdrop-blur-sm border-b border-white/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white">inchbyinch</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors ${
                isActive('/') 
                  ? 'text-white border-b-2 border-blue-400' 
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Deploy Strategy
            </Link>
            <Link 
              href="/dashboard" 
              className={`text-sm font-medium transition-colors ${
                isActive('/dashboard') 
                  ? 'text-white border-b-2 border-blue-400' 
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Dashboard
            </Link>
            <Link 
              href="/docs" 
              className={`text-sm font-medium transition-colors ${
                isActive('/docs') 
                  ? 'text-white border-b-2 border-blue-400' 
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Documentation
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
} 