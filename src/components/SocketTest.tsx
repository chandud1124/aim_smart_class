// src/components/SocketTest.tsx
import React, { useState } from 'react';
import { useSocketConnection, useDeviceState, useSwitchResult, useDeviceNotifications, useSocketTest } from '../hooks/useSocket';
import { ConnectionStatus } from '../context/SocketContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, Wifi, WifiOff } from 'lucide-react';

export function SocketTest() {
  const { isConnected, connectionError, socketId, reconnect } = useSocketConnection();
  const { deviceState, toggleSwitch, isLoading, error } = useDeviceState('test-device');
  const lastResult = useSwitchResult();
  const { notifications, clearNotifications } = useDeviceNotifications();
  const { pingResult, testConnection } = useSocketTest();

  const [testDeviceId, setTestDeviceId] = useState('esp32-test-001');
  const [testSwitchId, setTestSwitchId] = useState('switch-1');

  const handleToggleSwitch = () => {
    toggleSwitch(testSwitchId, !deviceState?.switches?.find(s => s.id === testSwitchId)?.state);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Socket.IO Test Panel</h2>
        <ConnectionStatus />
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {isConnected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
            <span>Connection Status</span>
          </CardTitle>
          <CardDescription>Test Socket.IO connection and real-time features</CardDescription>
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
              Test Ping
            </Button>
          </div>

          {pingResult && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                Ping: {pingResult.latency}ms
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Control Card */}
      <Card>
        <CardHeader>
          <CardTitle>Device Control Test</CardTitle>
          <CardDescription>Test device state management and switch toggling</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Device ID</label>
              <input
                type="text"
                value={testDeviceId}
                onChange={(e) => setTestDeviceId(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="esp32-test-001"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Switch ID</label>
              <input
                type="text"
                value={testSwitchId}
                onChange={(e) => setTestSwitchId(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="switch-1"
              />
            </div>
          </div>

          {deviceState && (
            <div className="p-3 bg-gray-50 rounded-md">
              <h4 className="font-medium mb-2">Device State</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Name: {deviceState.name}</div>
                <div>Status: <Badge variant={deviceState.status === 'online' ? 'default' : 'secondary'}>{deviceState.status}</Badge></div>
                <div>Last Seen: {new Date(deviceState.lastSeen).toLocaleString()}</div>
                <div>Switches: {deviceState.switches?.length || 0}</div>
              </div>
            </div>
          )}

          <Button
            onClick={handleToggleSwitch}
            disabled={!isConnected || isLoading}
            className="w-full"
          >
            {isLoading ? 'Toggling...' : 'Toggle Switch'}
          </Button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Switch Results Card */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle>Last Switch Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Device: {lastResult.deviceId}</div>
                <div>Switch: {lastResult.switchId}</div>
                <div>Requested: {lastResult.requestedState ? 'ON' : 'OFF'}</div>
                <div>Actual: {lastResult.actualState ? 'ON' : 'OFF'}</div>
                <div>Success: <Badge variant={lastResult.success ? 'default' : 'destructive'}>{lastResult.success ? 'Yes' : 'No'}</Badge></div>
                <div>Time: {new Date(lastResult.timestamp).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications Card */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Notifications
              <Button onClick={clearNotifications} variant="outline" size="sm">
                Clear
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {notifications.map((notification, index) => (
                <div key={index} className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <div className="font-medium">{notification.message}</div>
                  <div className="text-muted-foreground">
                    {notification.deviceName} ({notification.location}) - {new Date(notification.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}