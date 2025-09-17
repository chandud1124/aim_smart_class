# Socket.IO Integration Guide

This guide explains how to use the Socket.IO client implementation for real-time features in your React components.

## Overview

The Socket.IO implementation provides:
- Real-time device state updates
- Live switch toggle feedback
- Device connection/disconnection notifications
- Automatic reconnection handling
- React hooks for easy integration

## Quick Start

### 1. Import Required Hooks

```typescript
import {
  useSocketConnection,
  useDeviceState,
  useSwitchResult,
  useDeviceNotifications,
  useSocketTest
} from '@/hooks/useSocket';
```

### 2. Basic Connection Monitoring

```typescript
function MyComponent() {
  const { isConnected, connectionError, reconnect } = useSocketConnection();

  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      {connectionError && <p>Error: {connectionError}</p>}
      <button onClick={reconnect}>Reconnect</button>
    </div>
  );
}
```

### 3. Device State Management

```typescript
function DeviceControl({ deviceId }: { deviceId: string }) {
  const { deviceState, toggleSwitch, isLoading, error } = useDeviceState(deviceId);

  const handleToggle = (switchId: string, currentState: boolean) => {
    toggleSwitch(switchId, !currentState);
  };

  return (
    <div>
      {deviceState && (
        <div>
          <h3>{deviceState.name}</h3>
          <p>Status: {deviceState.status}</p>
          {deviceState.switches.map(switch => (
            <button
              key={switch.id}
              onClick={() => handleToggle(switch.id, switch.state)}
              disabled={isLoading}
            >
              {switch.name}: {switch.state ? 'ON' : 'OFF'}
            </button>
          ))}
        </div>
      )}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### 4. Real-time Notifications

```typescript
function NotificationDisplay() {
  const { notifications, clearNotifications } = useDeviceNotifications();

  return (
    <div>
      <h3>Recent Notifications</h3>
      {notifications.map((notification, index) => (
        <div key={index}>
          <p>{notification.message}</p>
          <small>{notification.deviceName} - {notification.timestamp}</small>
        </div>
      ))}
      <button onClick={clearNotifications}>Clear All</button>
    </div>
  );
}
```

## Available Hooks

### useSocketConnection()
Manages Socket.IO connection state and provides reconnection functionality.

**Returns:**
- `isConnected`: boolean - Current connection status
- `connectionError`: string | null - Last connection error
- `socketId`: string | undefined - Socket.IO client ID
- `reconnect()`: function - Manually trigger reconnection

### useDeviceState(deviceId?: string)
Manages real-time state for a specific device.

**Parameters:**
- `deviceId`: string (optional) - Device ID to monitor

**Returns:**
- `deviceState`: DeviceState | null - Current device state
- `toggleSwitch(switchId, state)`: function - Toggle a switch
- `isLoading`: boolean - Loading state for operations
- `error`: string | null - Last error message

### useSwitchResult()
Listens for switch toggle results and feedback.

**Returns:**
- `SwitchResult | null` - Last switch operation result

### useDeviceNotifications()
Manages device-related notifications.

**Returns:**
- `notifications`: DeviceNotification[] - Array of recent notifications
- `clearNotifications()`: function - Clear all notifications

### useBulkOperations()
Handles bulk switch operations and queuing.

**Returns:**
- `bulkIntent`: any - Current bulk operation intent
- `queuedToggles`: any[] - Queued toggle operations
- `blockedToggles`: any[] - Blocked toggle operations
- Clear functions for each array

### useSocketEvent(event: string, callback?)
Generic hook for custom Socket.IO events.

**Parameters:**
- `event`: string - Event name to listen for
- `callback`: function (optional) - Event handler

**Returns:**
- `emit(data?)`: function - Emit event to server

### useSocketRoom(room: string)
Manages Socket.IO room membership.

**Parameters:**
- `room`: string - Room name to join

### useSocketTest()
Provides connection testing functionality.

**Returns:**
- `pingResult`: any - Last ping test result
- `testConnection()`: function - Test connection latency

## Socket Events

The implementation listens for these server events:

### Device Events
- `device_state_changed` - Device state updates
- `device_connected` - Device comes online
- `device_disconnected` - Device goes offline
- `device_notification` - General device notifications

### Switch Events
- `switch_result` - Switch toggle result feedback
- `switch_intent` - Switch toggle intent (UI feedback)
- `bulk_switch_intent` - Bulk operation intent
- `device_toggle_queued` - Toggle queued for offline device
- `device_toggle_blocked` - Toggle blocked by system

### System Events
- `config_update` - Configuration changes
- `server_hello` - Server connection test

## Best Practices

### 1. Error Handling
Always handle connection errors and provide user feedback:

```typescript
const { connectionError, reconnect } = useSocketConnection();

if (connectionError) {
  // Show error UI and reconnect option
}
```

### 2. Loading States
Use loading states for better UX:

```typescript
const { isLoading } = useDeviceState(deviceId);

<button disabled={isLoading}>
  {isLoading ? 'Toggling...' : 'Toggle Switch'}
</button>
```

### 3. Cleanup
Hooks automatically handle cleanup, but for custom event listeners:

```typescript
useEffect(() => {
  const handleCustomEvent = (data) => {
    // Handle event
  };

  socketService.on('custom_event', handleCustomEvent);

  return () => {
    socketService.off('custom_event', handleCustomEvent);
  };
}, []);
```

### 4. Connection Monitoring
Monitor connection status for critical operations:

```typescript
const { isConnected } = useSocketConnection();

const handleCriticalAction = () => {
  if (!isConnected) {
    toast.error('No real-time connection. Action may not be immediate.');
  }
  // Proceed with action
};
```

## Integration with Existing Components

### Enhancing DeviceCard Component

```typescript
// In DeviceCard.tsx
import { useDeviceState } from '@/hooks/useSocket';

function DeviceCard({ device }) {
  const { deviceState, toggleSwitch } = useDeviceState(device.id);

  // Use real-time state if available, fallback to props
  const currentDevice = deviceState || device;

  return (
    <div>
      <h3>{currentDevice.name}</h3>
      <Badge variant={currentDevice.status === 'online' ? 'default' : 'secondary'}>
        {currentDevice.status}
      </Badge>
      {/* Rest of component */}
    </div>
  );
}
```

### Adding Real-time Status to Layout

```typescript
// In Layout.tsx
import { ConnectionStatus } from '@/context/SocketContext';

function Layout() {
  return (
    <div>
      <header>
        <ConnectionStatus />
      </header>
      {/* Rest of layout */}
    </div>
  );
}
```

## Testing

Use the `SocketTest` component for development testing:

```typescript
import { SocketTest } from '@/components/SocketTest';

// Add to a test route or development page
<SocketTest />
```

This provides:
- Connection status monitoring
- Manual reconnection
- Device control testing
- Real-time notification display
- Ping testing

## Troubleshooting

### Common Issues

1. **Connection fails**
   - Check backend URL configuration
   - Verify authentication token
   - Check network/firewall settings

2. **Events not received**
   - Verify event names match server
   - Check if component is mounted
   - Ensure proper cleanup of listeners

3. **State not updating**
   - Confirm device IDs match
   - Check if real-time events are being emitted
   - Verify Socket.IO server configuration

### Debug Mode

Enable debug logging:

```typescript
// In socket.ts
const DEBUG = true;

if (DEBUG) {
  console.log('[Socket.IO]', message, data);
}
```

## Migration from Polling

If migrating from polling-based updates:

1. Remove polling intervals
2. Replace API calls with socket event listeners
3. Add connection status indicators
4. Implement proper error handling
5. Test offline scenarios

Example migration:

```typescript
// Before (polling)
useEffect(() => {
  const interval = setInterval(async () => {
    const devices = await fetchDevices();
    setDevices(devices);
  }, 5000);

  return () => clearInterval(interval);
}, []);

// After (real-time)
useEffect(() => {
  const handleDeviceUpdate = (updatedDevice) => {
    setDevices(prev => prev.map(d =>
      d.id === updatedDevice.id ? updatedDevice : d
    ));
  };

  socketService.on('device_state_changed', handleDeviceUpdate);

  return () => {
    socketService.off('device_state_changed', handleDeviceUpdate);
  };
}, []);
```

This Socket.IO implementation provides a robust foundation for real-time features while maintaining compatibility with your existing IoT system architecture.