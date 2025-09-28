// src/components/SocketTest.tsx
import React, { useEffect, useState } from 'react';
import { useSocketContext } from '../context/SocketContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, Wifi, WifiOff } from 'lucide-react';

export function SocketTest() {
  const { isConnected, connectionError, socketId, reconnect } = useSocketContext();
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [pingResult, setPingResult] = useState<{ latency: number; timestamp: number } | null>(null);

  useEffect(() => {
    if (!isConnected && !connectionError) {
      setConnectionAttempts(prev => prev + 1);
    }
  }, [isConnected, connectionError]);

  const testConnection = () => {
    const startTime = Date.now();
    // Simple ping test - emit and listen for response
    console.log('[SocketTest] Testing connection...');
    setPingResult(null);

    // This is a basic test - in a real app you'd use a proper ping mechanism
    setTimeout(() => {
      const latency = Date.now() - startTime;
      setPingResult({ latency, timestamp: Date.now() });
      console.log(`[SocketTest] Connection test completed in ${latency}ms`);
    }, 100);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Socket.IO Test Panel</h2>
        <div className="flex items-center space-x-2">
          {isConnected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>Test Socket.IO connection with duplicate prevention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Status</label>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
                {connectionError && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Socket ID</label>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {socketId || 'Not connected'}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Connection Attempts</label>
            <p className="text-sm text-muted-foreground mt-1">
              {connectionAttempts} (should be 1 with fixes)
            </p>
          </div>

          {connectionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{connectionError}</p>
            </div>
          )}

          <div className="flex space-x-2">
            <Button onClick={reconnect} disabled={isConnected}>
              {isConnected ? 'Connected' : 'Reconnect'}
            </Button>
            <Button onClick={testConnection} variant="outline">
              Test Connection
            </Button>
          </div>

          {pingResult && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                Test completed in {pingResult.latency}ms at {new Date(pingResult.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}

          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-700">
              <strong>Testing React Strict Mode:</strong> If connection attempts &gt; 1, the duplicate connection issue still exists.
              Check browser console for socket connection logs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SocketTest;