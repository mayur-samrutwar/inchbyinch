import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { BarChart3, FileText, Home } from 'lucide-react';

export default function Navigation() {
  const router = useRouter();

  const isActive = (path) => {
    return router.pathname === path;
  };

  const navItems = [
    { href: '/', label: 'home', icon: Home },
    { href: '/dashboard', label: 'dashboard', icon: BarChart3 },
    { href: '/docs', label: 'documentation', icon: FileText },
  ];

  return (
    <nav className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/0">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="inchbyinch" className="w-8 h-8" />
              <span className="text-xl font-semibold text-white">
                inchbyinch
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => {
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors relative ${
                    isActive(item.href) 
                      ? 'text-gray-200' 
                      : 'text-white hover:text-gray-700'
                  }`}>
                    <span>{item.label}</span>
                    {isActive(item.href) && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          
          {/* Wallet Connect */}
          <div className="flex items-center space-x-2">
            <appkit-button balance="hide" />
          </div>
        </div>
      </div>
    </nav>
  );
} 