# WebSocket Strategy: Supabase Local + Firebase Cloud

## Current WebSocket Architecture

Your system currently uses **two types** of WebSocket connections:

### 1. Socket.IO (Frontend ↔ Backend)
- **Purpose**: Real-time UI updates, notifications, device state changes
- **Events**: `device_state_changed`, `switch_result`, `device_connected`, etc.
- **Clients**: Web browsers, mobile apps
- **Status**: ✅ Working (but not implemented in frontend yet)

### 2. Raw WebSocket (ESP32 ↔ Backend)
- **Purpose**: Device communication, commands, sensor data
- **Protocol**: Custom JSON messages
- **Events**: `identify`, `state_update`, `switch_command`, `heartbeat`
- **Clients**: ESP32 microcontrollers
- **Status**: ✅ Working

## WebSocket Options for Hybrid Setup

### Option 1: Keep Socket.IO (Recommended)
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │────│  Socket.IO  │────│   Backend   │
│  (Firebase) │    │   Client    │    │ (Supabase) │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Pros:**
- ✅ Minimal changes to existing backend
- ✅ Proven technology for real-time features
- ✅ Excellent for device control scenarios
- ✅ Built-in reconnection, rooms, namespaces

**Cons:**
- ❌ Additional complexity in hybrid setup
- ❌ Need to maintain Socket.IO server

### Option 2: Supabase Real-time Only
```
┌─────────────┐    ┌─────────────┐
│   Frontend  │────│   Supabase  │
│  (Firebase) │    │ Real-time   │
└─────────────┘    └─────────────┘
```

**Pros:**
- ✅ Simpler architecture
- ✅ Built-in PostgreSQL real-time
- ✅ Automatic reconnection

**Cons:**
- ❌ Cannot handle ESP32 WebSocket connections
- ❌ Limited real-time features compared to Socket.IO
- ❌ Requires significant backend changes

### Option 3: Firebase + Supabase Hybrid (Recommended)
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │────│   Firebase  │    │   Supabase  │
│             │    │ Real-time   │    │ Real-time   │
│             │────│   Database  │────│   + ESP32   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Recommended Implementation

### Phase 1: Socket.IO Client Setup (Frontend)

```typescript
// src/services/socket.ts
import { io, Socket } from 'socket.io-client';
import { getBackendOrigin } from './api';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.socket?.connected) return;

    const backendUrl = getBackendOrigin();
    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      auth: {
        token: localStorage.getItem('auth_token')
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from Socket.IO:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, manual reconnection needed
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.handleReconnect();
    });

    // Device state change events
    this.socket.on('device_state_changed', (data) => {
      console.log('Device state changed:', data);
      // Update your UI state here
    });

    this.socket.on('switch_result', (data) => {
      console.log('Switch result:', data);
      // Handle switch toggle results
    });

    this.socket.on('device_connected', (data) => {
      console.log('Device connected:', data);
      // Update device status in UI
    });

    this.socket.on('device_disconnected', (data) => {
      console.log('Device disconnected:', data);
      // Update device status in UI
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
        this.socket?.connect();
      }, 1000 * this.reconnectAttempts); // Exponential backoff
    }
  }

  private reconnect() {
    if (this.socket) {
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Send events to server
  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  // Listen for custom events
  on(event: string, callback: Function) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Remove event listener
  off(event: string, callback?: Function) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
```

### Phase 2: React Integration

```typescript
// src/hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import socketService from '../services/socket';

export const useSocket = () => {
  const isConnectedRef = useRef(false);

  useEffect(() => {
    // Connect when component mounts
    if (!isConnectedRef.current) {
      socketService.connect();
      isConnectedRef.current = true;
    }

    // Cleanup on unmount
    return () => {
      // Don't disconnect here as other components might be using it
    };
  }, []);

  return socketService;
};

// src/hooks/useDeviceState.ts
import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';

export const useDeviceState = (deviceId?: string) => {
  const [devices, setDevices] = useState([]);
  const [deviceStates, setDeviceStates] = useState(new Map());
  const socket = useSocket();

  useEffect(() => {
    const handleDeviceStateChange = (data) => {
      setDeviceStates(prev => {
        const newStates = new Map(prev);
        newStates.set(data.deviceId, data.state);
        return newStates;
      });
    };

    const handleDeviceConnected = (data) => {
      setDevices(prev => prev.map(device =>
        device.id === data.deviceId
          ? { ...device, status: 'online' }
          : device
      ));
    };

    const handleDeviceDisconnected = (data) => {
      setDevices(prev => prev.map(device =>
        device.id === data.deviceId
          ? { ...device, status: 'offline' }
          : device
      ));
    };

    // Register event listeners
    socket.on('device_state_changed', handleDeviceStateChange);
    socket.on('device_connected', handleDeviceConnected);
    socket.on('device_disconnected', handleDeviceDisconnected);

    // Cleanup
    return () => {
      socket.off('device_state_changed', handleDeviceStateChange);
      socket.off('device_connected', handleDeviceConnected);
      socket.off('device_disconnected', handleDeviceDisconnected);
    };
  }, [socket, deviceId]);

  return { devices, deviceStates };
};
```

### Phase 3: Component Usage

```typescript
// src/components/DeviceCard.tsx
import React from 'react';
import { useDeviceState } from '../hooks/useDeviceState';
import socketService from '../services/socket';

const DeviceCard = ({ device }) => {
  const { deviceStates } = useDeviceState(device.id);
  const currentState = deviceStates.get(device.id) || device;

  const handleToggleSwitch = async (switchId, newState) => {
    try {
      // Send command via Socket.IO for immediate feedback
      socketService.emit('toggle_switch', {
        deviceId: device.id,
        switchId,
        state: newState
      });

      // Also send via REST API for reliability
      await deviceAPI.toggleSwitch(device.id, switchId, newState);
    } catch (error) {
      console.error('Failed to toggle switch:', error);
    }
  };

  return (
    <div className="device-card">
      <h3>{currentState.name}</h3>
      <div className="status">
        Status: <span className={currentState.status === 'online' ? 'online' : 'offline'}>
          {currentState.status}
        </span>
      </div>

      {currentState.switches?.map(switch => (
        <button
          key={switch.id}
          onClick={() => handleToggleSwitch(switch.id, !switch.state)}
          className={switch.state ? 'on' : 'off'}
        >
          {switch.name}: {switch.state ? 'ON' : 'OFF'}
        </button>
      ))}
    </div>
  );
};
```

### Phase 4: Supabase Real-time Integration

```typescript
// src/services/supabaseRealtime.ts
import { createClient } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class SupabaseRealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  subscribeToDeviceUpdates(deviceId: string, callback: (payload: any) => void) {
    const channelName = `device_${deviceId}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'devices',
        filter: `id=eq.${deviceId}`
      }, callback)
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  subscribeToActivityLogs(callback: (payload: any) => void) {
    const channel = supabase.channel('activity_logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs'
      }, callback)
      .subscribe();

    this.channels.set('activity_logs', channel);
    return channel;
  }

  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
    }
  }

  unsubscribeAll() {
    this.channels.forEach(channel => channel.unsubscribe());
    this.channels.clear();
  }
}

export const supabaseRealtime = new SupabaseRealtimeService();
```

## ESP32 WebSocket Strategy

### Current Setup (Keep As-Is)
Your ESP32 devices use raw WebSocket connections for:
- Device identification and authentication
- Real-time state updates
- Command execution
- Heartbeat monitoring

**Recommendation**: Keep the existing ESP32 WebSocket implementation unchanged. Supabase doesn't provide a replacement for device-to-server WebSocket connections.

### ESP32 Code Changes (Minimal)

```cpp
// esp32_websocket_client.ino
// Keep existing WebSocket client code
// Just update server URL to point to your local Supabase backend

const char* websocket_server = "ws://localhost:3001/esp32-ws";
// or if running on different machine:
// const char* websocket_server = "ws://192.168.1.100:3001/esp32-ws";
```

## Firebase Integration

### Firebase Hosting + Functions (Optional)

```typescript
// If you want to use Firebase Functions as proxy
// functions/src/index.ts
import * as functions from 'firebase-functions';
import { SocketService } from './socketService';

export const proxySocketEvent = functions.https.onCall(async (data, context) => {
  // Proxy Socket.IO events through Firebase Functions
  const socketService = new SocketService();
  return await socketService.sendToBackend(data);
});
```

## Migration Steps

### Week 1: Socket.IO Client Setup
1. ✅ Install `socket.io-client` (already done)
2. Create Socket service
3. Add React hooks
4. Test basic connection

### Week 2: Real-time Features
1. Implement device state updates
2. Add switch control feedback
3. Test device connection status
4. Add error handling

### Week 3: Supabase Real-time
1. Set up Supabase real-time subscriptions
2. Integrate with existing Socket.IO
3. Test hybrid real-time features
4. Optimize performance

### Week 4: Production Ready
1. Add reconnection logic
2. Implement offline handling
3. Test with real ESP32 devices
4. Performance optimization

## Benefits of This Approach

✅ **Backward Compatible**: ESP32 devices continue working unchanged
✅ **Real-time Rich**: Socket.IO provides excellent real-time features
✅ **Scalable**: Can handle thousands of concurrent connections
✅ **Reliable**: Built-in reconnection and error handling
✅ **Hybrid Ready**: Works with both Firebase and Supabase

## Performance Considerations

- **Connection Pooling**: Socket.IO handles connection limits well
- **Message Batching**: Reduce WebSocket message frequency
- **Compression**: Enable Socket.IO compression for large payloads
- **Load Balancing**: Consider Redis adapter for multiple backend instances

Would you like me to implement the Socket.IO client setup for your frontend?