// src/services/socket.ts
import { io, Socket } from 'socket.io-client';
import { getBackendOrigin } from './api';

export interface DeviceState {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  switches: Array<{
    id: string;
    name: string;
    state: boolean;
    type: string;
    gpio: number;
  }>;
  lastSeen: string;
}

export interface SwitchResult {
  deviceId: string;
  switchId: string;
  requestedState: boolean;
  actualState: boolean;
  success: boolean;
  timestamp: number;
}

export interface DeviceNotification {
  type: 'device_connected' | 'device_disconnected' | 'device_updated' | 'device_deleted' | 'device_created' | 'switch_changed' | 'bulk_operation' | 'schedule_executed' | 'device_error' | 'system_alert';
  message: string;
  deviceId?: string;
  deviceName?: string;
  location?: string;
  switchId?: string;
  switchName?: string;
  newState?: boolean;
  operation?: string;
  results?: any[];
  scheduleId?: string;
  scheduleName?: string;
  severity?: string;
  timestamp: Date;
}

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isConnecting = false;

  constructor() {
    this.setupGlobalErrorHandling();
  }

  private setupGlobalErrorHandling() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden, reduce reconnection attempts
        this.maxReconnectAttempts = 2;
      } else {
        // Page is visible, restore normal reconnection
        this.maxReconnectAttempts = 5;
        if (!this.socket?.connected) {
          this.connect();
        }
      }
    });

    // Handle beforeunload
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Prevent duplicate connection attempts
      if (this.isConnecting || this.socket?.connected) {
        if (this.socket?.connected) {
          resolve();
        } else {
          // Wait for existing connection attempt to complete
          const checkConnection = () => {
            if (this.socket?.connected) {
              resolve();
            } else if (!this.isConnecting) {
              reject(new Error('Connection failed'));
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          setTimeout(checkConnection, 100);
        }
        return;
      }

      this.isConnecting = true;

      try {
        const backendUrl = getBackendOrigin();
        console.log('[Socket.IO] Connecting to:', backendUrl);

        this.socket = io(backendUrl, {
          // Force polling transport only to avoid WebSocket frame header issues
          transports: ['polling'],
          timeout: 20000,
          forceNew: false, // Don't force new connections
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          // Disable perMessageDeflate to avoid header corruption
          perMessageDeflate: { threshold: 0 },
          // Don't remember upgrades to avoid header issues
          rememberUpgrade: false,
          // Add auth token if available
          auth: {
            token: localStorage.getItem('auth_token')
          },
          // Additional stability settings
          upgrade: false, // Disable WebSocket upgrade
          randomizationFactor: 0.5,
          // Disable compression to avoid frame header issues
          forceBase64: false
        });

        this.setupEventListeners();

        this.socket.on('connect', () => {
          console.log('[Socket.IO] Connected successfully');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('[Socket.IO] Connection error:', error);
          this.isConnecting = false;
          reject(error);
        });

        // Timeout for connection attempt
        setTimeout(() => {
          if (!this.socket?.connected) {
            this.isConnecting = false;
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error('[Socket.IO] Setup error:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, manual reconnection needed
        setTimeout(() => this.connect(), 1000);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket.IO] Connection error:', error);
      this.handleReconnect();
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket.IO] Reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('[Socket.IO] Reconnection error:', error);
    });

    // Server hello (connection test)
    this.socket.on('server_hello', (data) => {
      console.log('[Socket.IO] Server hello:', data);
    });

    // Device state change events
    this.socket.on('device_state_changed', (data) => {
      console.log('[Socket.IO] Device state changed:', data);
      this.emitToListeners('device_state_changed', data);
    });

    // Switch result events
    this.socket.on('switch_result', (data: SwitchResult) => {
      console.log('[Socket.IO] Switch result:', data);
      this.emitToListeners('switch_result', data);
    });

    // Device connection events
    this.socket.on('device_connected', (data) => {
      console.log('[Socket.IO] Device connected:', data);
      this.emitToListeners('device_connected', data);
    });

    this.socket.on('device_disconnected', (data) => {
      console.log('[Socket.IO] Device disconnected:', data);
      this.emitToListeners('device_disconnected', data);
    });

    // Device notifications
    this.socket.on('device_notification', (data: DeviceNotification) => {
      console.log('[Socket.IO] Device notification:', data);
      this.emitToListeners('device_notification', data);
    });

    // Bulk operations
    this.socket.on('bulk_switch_intent', (data) => {
      console.log('[Socket.IO] Bulk switch intent:', data);
      this.emitToListeners('bulk_switch_intent', data);
    });

    // Switch intents (for UI feedback)
    this.socket.on('switch_intent', (data) => {
      console.log('[Socket.IO] Switch intent:', data);
      this.emitToListeners('switch_intent', data);
    });

    // Queued toggles (when device is offline)
    this.socket.on('device_toggle_queued', (data) => {
      console.log('[Socket.IO] Device toggle queued:', data);
      this.emitToListeners('device_toggle_queued', data);
    });

    // Blocked toggles
    this.socket.on('device_toggle_blocked', (data) => {
      console.log('[Socket.IO] Device toggle blocked:', data);
      this.emitToListeners('device_toggle_blocked', data);
    });

    // Configuration updates
    this.socket.on('config_update', (data) => {
      console.log('[Socket.IO] Config update:', data);
      this.emitToListeners('config_update', data);
    });

    // User profile update events
    this.socket.on('user_profile_updated', (data) => {
      console.log('[Socket.IO] User profile updated:', data);
      this.emitToListeners('user_profile_updated', data);
    });

    this.socket.on('user_role_changed', (data) => {
      console.log('[Socket.IO] User role changed:', data);
      this.emitToListeners('user_role_changed', data);
    });

    this.socket.on('user_updated', (data) => {
      console.log('[Socket.IO] User updated (admin notification):', data);
      this.emitToListeners('user_updated', data);
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`[Socket.IO] Reconnecting in ${delay}ms... Attempt ${this.reconnectAttempts}`);

      setTimeout(() => {
        if (this.socket && !this.socket.connected) {
          this.socket.connect();
        }
      }, delay);
    } else {
      console.error('[Socket.IO] Max reconnection attempts reached');
    }
  }

  private emitToListeners(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Socket.IO] Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Public API methods
  disconnect() {
    if (this.socket) {
      console.log('[Socket.IO] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.eventListeners.clear();
  }

  // Send events to server
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[Socket.IO] Not connected, cannot emit:', event, data);
    }
  }

  // Listen for events
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  // Remove event listener
  off(event: string, callback?: Function) {
    if (!callback) {
      this.eventListeners.delete(event);
    } else {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    }
  }

  // Join a room (for targeted notifications)
  joinRoom(room: string) {
    this.emit('join-room', room);
  }

  // Leave a room
  leaveRoom(room: string) {
    this.emit('leave-room', room);
  }

  // Test connection
  ping(callback?: (pong: any) => void) {
    if (callback) {
      this.emit('ping_test', callback);
    } else {
      this.emit('ping_test', { timestamp: Date.now() });
    }
  }

  // Get connection status
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get socket ID
  get socketId(): string | undefined {
    return this.socket?.id;
  }

  // Device specific events
  public onDeviceStateChanged(callback: (data: { deviceId: string; state: DeviceState }) => void) {
    this.on('device_state_changed', callback);
  }

  public onDevicePirTriggered(callback: (data: { deviceId: string; triggered: boolean }) => void) {
    this.on('device_pir_triggered', callback);
  }

  public onDeviceConnected(callback: (data: { deviceId: string }) => void) {
    this.on('device_connected', callback);
  }

  public onDeviceDisconnected(callback: (data: { deviceId: string }) => void) {
    this.on('device_disconnected', callback);
  }

  public onDeviceToggleBlocked(callback: (data: { deviceId: string; switchId: string; reason: string; requestedState?: boolean; timestamp: number }) => void) {
    this.on('device_toggle_blocked', callback);
  }
}

// Create singleton instance
export const socketService = new SocketService();
export default socketService;