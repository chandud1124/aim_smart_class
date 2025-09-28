// src/hooks/useSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import socketService, { DeviceState, SwitchResult, DeviceNotification } from '../services/socket';

export function useSocketConnection() {
  const [isConnected, setIsConnected] = useState(socketService.isConnected);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [socketId, setSocketId] = useState<string | undefined>(socketService.socketId);

  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
      setSocketId(socketService.socketId);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setSocketId(undefined);
    };

    const handleConnectError = (error: any) => {
      setConnectionError(error.message || 'Connection failed');
      setIsConnected(false);
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('connect_error', handleConnectError);

    // Don't auto-connect here - let SocketProvider handle connections
    // This prevents duplicate connections

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('connect_error', handleConnectError);
    };
  }, []);

  const reconnect = useCallback(() => {
    setConnectionError(null);
    socketService.connect().catch((error) => {
      setConnectionError(error.message || 'Reconnection failed');
    });
  }, []);

  return {
    isConnected,
    connectionError,
    socketId,
    reconnect
  };
}

export function useDeviceState(deviceId?: string) {
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleDeviceStateChanged = (data: DeviceState) => {
      if (!deviceId || data.id === deviceId) {
        setDeviceState(data);
        setError(null);
      }
    };

    const handleDeviceConnected = (data: { deviceId: string; deviceName: string; location: string }) => {
      if (!deviceId || data.deviceId === deviceId) {
        setDeviceState(prev => prev ? {
          ...prev,
          status: 'online' as const,
          lastSeen: new Date().toISOString()
        } : null);
      }
    };

    const handleDeviceDisconnected = (data: { deviceId: string; deviceName: string; location: string }) => {
      if (!deviceId || data.deviceId === deviceId) {
        setDeviceState(prev => prev ? {
          ...prev,
          status: 'offline' as const,
          lastSeen: new Date().toISOString()
        } : null);
      }
    };

    socketService.on('device_state_changed', handleDeviceStateChanged);
    socketService.on('device_connected', handleDeviceConnected);
    socketService.on('device_disconnected', handleDeviceDisconnected);

    return () => {
      socketService.off('device_state_changed', handleDeviceStateChanged);
      socketService.off('device_connected', handleDeviceConnected);
      socketService.off('device_disconnected', handleDeviceDisconnected);
    };
  }, [deviceId]);

  const toggleSwitch = useCallback(async (switchId: string, state: boolean) => {
    if (!deviceId) return;

    setIsLoading(true);
    setError(null);

    try {
      socketService.emit('toggle_switch', {
        deviceId,
        switchId,
        state
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle switch');
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  return {
    deviceState,
    isLoading,
    error,
    toggleSwitch
  };
}

export function useSwitchResult() {
  const [lastResult, setLastResult] = useState<SwitchResult | null>(null);

  useEffect(() => {
    const handleSwitchResult = (data: SwitchResult) => {
      setLastResult(data);
    };

    socketService.on('switch_result', handleSwitchResult);

    return () => {
      socketService.off('switch_result', handleSwitchResult);
    };
  }, []);

  return lastResult;
}

export function useDeviceNotifications() {
  const [notifications, setNotifications] = useState<DeviceNotification[]>([]);

  useEffect(() => {
    const handleDeviceNotification = (data: any) => {
      const notification: DeviceNotification = {
        type: data.type,
        message: data.message,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        location: data.location,
        timestamp: data.timestamp || new Date(),
        ...data
      };
      setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50 notifications
    };

    const handleSwitchChange = (data: any) => {
      const notification: DeviceNotification = {
        type: 'switch_changed',
        message: `Switch ${data.switchName} turned ${data.newState ? 'ON' : 'OFF'} on ${data.deviceName}`,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        location: data.location,
        switchId: data.switchId,
        switchName: data.switchName,
        newState: data.newState,
        timestamp: data.timestamp || new Date()
      };
      setNotifications(prev => [notification, ...prev].slice(0, 50));
    };

    const handleBulkOperation = (data: any) => {
      const notification: DeviceNotification = {
        type: 'bulk_operation',
        message: `Bulk ${data.operation} completed: ${data.successCount} successful, ${data.failureCount} failed`,
        operation: data.operation,
        results: data.results,
        timestamp: data.timestamp || new Date()
      };
      setNotifications(prev => [notification, ...prev].slice(0, 50));
    };

    const handleScheduleExecuted = (data: any) => {
      const notification: DeviceNotification = {
        type: 'schedule_executed',
        message: `Schedule "${data.scheduleName}" executed: ${data.successCount} successful, ${data.failureCount} failed`,
        scheduleId: data.scheduleId,
        scheduleName: data.scheduleName,
        results: data.results,
        timestamp: data.timestamp || new Date()
      };
      setNotifications(prev => [notification, ...prev].slice(0, 50));
    };

    const handleDeviceError = (data: any) => {
      const notification: DeviceNotification = {
        type: 'device_error',
        message: data.error,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        location: data.location,
        severity: 'high',
        timestamp: data.timestamp || new Date()
      };
      setNotifications(prev => [notification, ...prev].slice(0, 50));
    };

    const handleSystemAlert = (data: any) => {
      const notification: DeviceNotification = {
        type: 'system_alert',
        message: data.message,
        severity: data.severity || 'medium',
        timestamp: data.timestamp || new Date()
      };
      setNotifications(prev => [notification, ...prev].slice(0, 50));
    };

    // Listen to all notification events
    socketService.on('device_notification', handleDeviceNotification);
    socketService.on('switch:changed', handleSwitchChange);
    socketService.on('bulk_operation_complete', handleBulkOperation);
    socketService.on('schedule_executed', handleScheduleExecuted);
    socketService.on('device_error_alert', handleDeviceError);
    socketService.on('system_alert', handleSystemAlert);

    return () => {
      socketService.off('device_notification', handleDeviceNotification);
      socketService.off('switch:changed', handleSwitchChange);
      socketService.off('bulk_operation_complete', handleBulkOperation);
      socketService.off('schedule_executed', handleScheduleExecuted);
      socketService.off('device_error_alert', handleDeviceError);
      socketService.off('system_alert', handleSystemAlert);
    };
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    clearNotifications
  };
}

export function useBulkOperations() {
  const [bulkIntent, setBulkIntent] = useState<any>(null);
  const [queuedToggles, setQueuedToggles] = useState<any[]>([]);
  const [blockedToggles, setBlockedToggles] = useState<any[]>([]);

  useEffect(() => {
    const handleBulkIntent = (data: any) => {
      setBulkIntent(data);
    };

    const handleQueuedToggle = (data: any) => {
      setQueuedToggles(prev => [...prev, data]);
    };

    const handleBlockedToggle = (data: any) => {
      setBlockedToggles(prev => [...prev, data]);
    };

    socketService.on('bulk_switch_intent', handleBulkIntent);
    socketService.on('device_toggle_queued', handleQueuedToggle);
    socketService.on('device_toggle_blocked', handleBlockedToggle);

    return () => {
      socketService.off('bulk_switch_intent', handleBulkIntent);
      socketService.off('device_toggle_queued', handleQueuedToggle);
      socketService.off('device_toggle_blocked', handleBlockedToggle);
    };
  }, []);

  const clearBulkIntent = useCallback(() => {
    setBulkIntent(null);
  }, []);

  const clearQueuedToggles = useCallback(() => {
    setQueuedToggles([]);
  }, []);

  const clearBlockedToggles = useCallback(() => {
    setBlockedToggles([]);
  }, []);

  return {
    bulkIntent,
    queuedToggles,
    blockedToggles,
    clearBulkIntent,
    clearQueuedToggles,
    clearBlockedToggles
  };
}

export function useSocketEvent<T = any>(event: string, callback?: (data: T) => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (data: T) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    };

    socketService.on(event, handler);

    return () => {
      socketService.off(event, handler);
    };
  }, [event]);

  const emit = useCallback((data?: any) => {
    socketService.emit(event, data);
  }, [event]);

  return { emit };
}

// Hook for managing socket rooms
export function useSocketRoom(room: string) {
  useEffect(() => {
    socketService.joinRoom(room);

    return () => {
      socketService.leaveRoom(room);
    };
  }, [room]);
}

// Hook for testing socket connection
export function useSocketTest() {
  const [pingResult, setPingResult] = useState<any>(null);

  const testConnection = useCallback(() => {
    socketService.ping((pong) => {
      setPingResult({
        sent: new Date().toISOString(),
        received: pong,
        latency: Date.now() - new Date(pong.timestamp).getTime()
      });
    });
  }, []);

  return {
    pingResult,
    testConnection
  };
}