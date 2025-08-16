import React, { createContext, useContext, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface NotificationContextType {
  isConnected: boolean;
  notifications: any[];
  requestPermission: () => Promise<boolean>;
  subscribe: (location: { lat: number; lng: number }, radius: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const newSocket = io((import.meta as any).env.VITE_API_URL || 'http://localhost:3000');
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to EcoGuard server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('alert', (alert) => {
      setNotifications(prev => [alert, ...prev.slice(0, 9)]);
      
      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification(alert.title, {
          body: alert.body,
          icon: '/icons/alert-icon.png',
          tag: `ecoguard-${alert.type}`
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  const subscribe = async (location: { lat: number; lng: number }, radius: number) => {
    try {
      const response = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:3000'}/v1/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          radius_km: radius,
          channels: ['webpush'],
          language: 'en'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Subscribed successfully:', data);
        
        // Join WebSocket room for this subscription
        if (socket) {
          socket.emit('subscribe', { channels: [`alerts:${data.subscription.id}`] });
        }
      }
    } catch (error) {
      console.error('Subscription failed:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{
      isConnected,
      notifications,
      requestPermission,
      subscribe
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};