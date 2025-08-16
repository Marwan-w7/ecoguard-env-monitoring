import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, Map, Bell, BookOpen, Settings } from 'lucide-react';

export const Navigation: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Map, label: 'Map' },
    { path: '/alerts', icon: Bell, label: 'Alerts' },
    { path: '/guides', icon: BookOpen, label: 'Guides' },
    { path: '/admin', icon: Settings, label: 'Admin' },
  ];

  return (
    <nav className="bg-primary text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8" />
            <span className="text-xl font-bold">EcoGuard</span>
          </div>
          
          <div className="flex space-x-4">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === path
                    ? 'bg-white bg-opacity-20'
                    : 'hover:bg-white hover:bg-opacity-10'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};