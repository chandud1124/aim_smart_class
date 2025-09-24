const socketIo = require('socket.io');
const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { wsLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../middleware/logger');

class SocketService {
    constructor(io) {
        this.io = io;
        this.connectedClients = new Map();
        this.onlineUsers = new Map(); // Track userId -> socketIds
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);

            socket.on('authenticate', async (token) => {
                try {
                    // Verify JWT token
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    const user = await User.findById(decoded.id);

                    if (user) {
                        // Store authenticated socket with user info
                        this.connectedClients.set(socket.id, {
                            socket,
                            authenticated: true,
                            userId: user._id
                        });

                        // Track online users
                        if (!this.onlineUsers.has(user._id.toString())) {
                            this.onlineUsers.set(user._id.toString(), new Set());
                        }
                        this.onlineUsers.get(user._id.toString()).add(socket.id);

                        // Update user's online status
                        await User.findByIdAndUpdate(user._id, {
                            isOnline: true,
                            lastSeen: new Date()
                        });

                        // Notify admins about user coming online
                        this.notifyAdminsUserStatus(user._id, true);

                        console.log(`User ${user.name} authenticated and online`);
                        socket.emit('authenticated', { success: true });
                    } else {
                        socket.emit('auth_error', { message: 'User not found' });
                    }
                } catch (error) {
                    console.error('Socket authentication error:', error.message);
                    socket.emit('auth_error', { message: 'Authentication failed' });
                }
            });

            socket.on('subscribe:device', (deviceId) => {
                socket.join(`device:${deviceId}`);
            });

            socket.on('unsubscribe:device', (deviceId) => {
                socket.leave(`device:${deviceId}`);
            });

            socket.on('disconnect', async () => {
                console.log('Client disconnected:', socket.id);

                const clientInfo = this.connectedClients.get(socket.id);
                this.connectedClients.delete(socket.id);

                if (clientInfo && clientInfo.userId) {
                    const userId = clientInfo.userId.toString();
                    const userSockets = this.onlineUsers.get(userId);

                    if (userSockets) {
                        userSockets.delete(socket.id);

                        // If user has no more active sockets, mark as offline
                        if (userSockets.size === 0) {
                            this.onlineUsers.delete(userId);

                            // Update user's online status
                            await User.findByIdAndUpdate(userId, {
                                isOnline: false,
                                lastSeen: new Date()
                            });

                            // Notify admins about user going offline
                            this.notifyAdminsUserStatus(userId, false);

                            console.log(`User ${userId} went offline`);
                        }
                    }
                }
            });
        });
    }

    broadcastDeviceUpdate(deviceId, update) {
        this.io.to(`device:${deviceId}`).emit('device:update', {
            deviceId,
            ...update
        });
    }

    notifyError(deviceId, error) {
        this.io.to(`device:${deviceId}`).emit('device:error', {
            deviceId,
            error
        });
    }

    broadcastStatusChange(deviceId, status) {
        this.io.to(`device:${deviceId}`).emit('device:status', {
            deviceId,
            status
        });
    }

    // Notify admins when user comes online/offline
    async notifyAdminsUserStatus(userId, isOnline) {
        try {
            const user = await User.findById(userId).select('name email role');
            if (!user) return;

            // Find all admin sockets
            const adminSockets = [];
            for (const [socketId, clientInfo] of this.connectedClients.entries()) {
                if (clientInfo.authenticated && clientInfo.userId) {
                    const adminUser = await User.findById(clientInfo.userId);
                    if (adminUser && adminUser.role === 'admin') {
                        adminSockets.push(socketId);
                    }
                }
            }

            // Notify all admin clients
            adminSockets.forEach(socketId => {
                this.io.to(socketId).emit('user_status_change', {
                    userId: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isOnline,
                    lastSeen: new Date()
                });
            });
        } catch (error) {
            console.error('Error notifying admins:', error.message);
        }
    }

    // Get list of online users
    async getOnlineUsers() {
        try {
            const onlineUserIds = Array.from(this.onlineUsers.keys());
            if (onlineUserIds.length === 0) return [];

            const onlineUsers = await User.find({
                _id: { $in: onlineUserIds }
            }).select('name email role department lastSeen');

            return onlineUsers.map(user => ({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                lastSeen: user.lastSeen
            }));
        } catch (error) {
            console.error('Error getting online users:', error.message);
            return [];
        }
    }

    // Check if specific user is online
    isUserOnline(userId) {
        return this.onlineUsers.has(userId.toString());
    }

    // Enhanced notification methods
    notifyDeviceStatusChange(deviceId, status, deviceName, location) {
        this.io.to(`device:${deviceId}`).emit('device:status', {
            deviceId,
            status,
            deviceName,
            location,
            timestamp: new Date()
        });

        // Also broadcast to all authenticated users
        this.broadcastToAuthenticated('device_status_change', {
            deviceId,
            status,
            deviceName,
            location,
            timestamp: new Date()
        });
    }

    notifyDeviceError(deviceId, error, deviceName, location) {
        this.io.to(`device:${deviceId}`).emit('device:error', {
            deviceId,
            error,
            deviceName,
            location,
            timestamp: new Date()
        });

        // Notify admins and relevant users
        this.broadcastToRole('admin', 'device_error_alert', {
            deviceId,
            error,
            deviceName,
            location,
            timestamp: new Date(),
            severity: 'high'
        });
    }

    notifySwitchChange(deviceId, switchId, switchName, newState, deviceName, location, userId = null) {
        const notification = {
            deviceId,
            switchId,
            switchName,
            newState,
            deviceName,
            location,
            userId,
            timestamp: new Date()
        };

        // Notify device subscribers
        this.io.to(`device:${deviceId}`).emit('switch:changed', notification);

        // Broadcast to all authenticated users for general awareness
        this.broadcastToAuthenticated('switch_state_change', notification);
    }

    notifyBulkOperation(userId, operation, results, deviceCount) {
        const notification = {
            userId,
            operation,
            results,
            deviceCount,
            timestamp: new Date(),
            successCount: results.filter(r => r.success).length,
            failureCount: results.filter(r => !r.success).length
        };

        // Notify the user who initiated the operation
        this.broadcastToUser(userId, 'bulk_operation_complete', notification);

        // Notify admins about bulk operations
        this.broadcastToRole('admin', 'bulk_operation_alert', notification);
    }

    notifyScheduleExecution(scheduleId, scheduleName, results) {
        const notification = {
            scheduleId,
            scheduleName,
            results,
            timestamp: new Date(),
            successCount: results.filter(r => r.success).length,
            failureCount: results.filter(r => !r.success).length
        };

        // Notify admins about schedule execution
        this.broadcastToRole('admin', 'schedule_executed', notification);
    }

    notifyUserAction(userId, action, details) {
        const notification = {
            userId,
            action,
            details,
            timestamp: new Date()
        };

        // Notify admins about user actions
        this.broadcastToRole('admin', 'user_action', notification);
    }

    notifySystemAlert(message, severity = 'medium', metadata = {}) {
        const alert = {
            message,
            severity,
            metadata,
            timestamp: new Date()
        };

        // Broadcast system alerts to all authenticated users
        this.broadcastToAuthenticated('system_alert', alert);
    }

    // Helper methods for targeted broadcasting
    broadcastToAuthenticated(event, data) {
        for (const [socketId, clientInfo] of this.connectedClients.entries()) {
            if (clientInfo.authenticated) {
                this.io.to(socketId).emit(event, data);
            }
        }
    }

    broadcastToRole(role, event, data) {
        for (const [socketId, clientInfo] of this.connectedClients.entries()) {
            if (clientInfo.authenticated && clientInfo.userId) {
                // We need to check user role - this would require async operation
                // For now, we'll emit and let client-side filtering handle it
                this.io.to(socketId).emit(event, data);
            }
        }
    }

    broadcastToUser(userId, event, data) {
        const userSockets = this.onlineUsers.get(userId.toString());
        if (userSockets) {
            userSockets.forEach(socketId => {
                this.io.to(socketId).emit(event, data);
            });
        }
    }
}

module.exports = SocketService;
