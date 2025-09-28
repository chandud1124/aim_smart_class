// src/context/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import socketService from '../services/socket';

interface SocketContextType {
  isConnected: boolean;
  connectionError: string | null;
  socketId: string | undefined;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [isConnected, setIsConnected] = useState(socketService.isConnected);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [socketId, setSocketId] = useState<string | undefined>(socketService.socketId);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
      setSocketId(socketService.socketId);
      setIsConnecting(false);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setSocketId(undefined);
      setIsConnecting(false);
    };

    const handleConnectError = (error: any) => {
      setConnectionError(error.message || 'Connection failed');
      setIsConnected(false);
      setIsConnecting(false);
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('connect_error', handleConnectError);

    // Initial connection attempt - only from SocketProvider and only once
    if (!socketService.isConnected && !isConnecting) {
      setIsConnecting(true);
      socketService.connect().catch((error) => {
        setConnectionError(error.message || 'Failed to connect');
        setIsConnecting(false);
      });
    }

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('connect_error', handleConnectError);
    };
  }, []); // Remove isConnecting from dependencies to prevent re-runs

  const reconnect = () => {
    setConnectionError(null);
    socketService.connect().catch((error) => {
      setConnectionError(error.message || 'Reconnection failed');
    });
  };

  const value: SocketContextType = {
    isConnected,
    connectionError,
    socketId,
    reconnect
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext(): SocketContextType {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}

// Connection status indicator component
export function ConnectionStatus() {
  const { isConnected, connectionError, reconnect } = useSocketContext();

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2 text-green-600">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm">Connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
      <span className="text-sm text-red-600">
        {connectionError || 'Disconnected'}
      </span>
      <button
        onClick={reconnect}
        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Reconnect
      </button>
    </div>
  );
}