const DevicePermission = require('../models/DevicePermission');
const Device = require('../models/Device');
const User = require('../models/User');
const { logger } = require('../middleware/logger');

// Check if user can perform specific action on device
const checkDevicePermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            const { deviceId } = req.params;
            const userId = req.user._id;
            
            // Admin bypass
            if (req.user.role === 'admin' || req.user.role === 'super-admin') {
                return next();
            }
            
            // Get device info
            const device = await Device.findById(deviceId);
            if (!device) {
                return res.status(404).json({ message: 'Device not found' });
            }
            
            // Check general device access first (existing system)
            if (req.user.assignedDevices?.includes(deviceId)) {
                return next();
            }
            
            // Check specific device permission
            const permission = await DevicePermission.findOne({
                user: userId,
                device: deviceId,
                isActive: true,
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: { $gt: new Date() } }
                ]
            }).populate('device');
            
            // If no specific device permission exists, fall back to role-based permissions
            if (!permission) {
                // Role-based fallback - check if user role allows device control
                const rolePermissions = {
                    admin: { canTurnOn: true, canTurnOff: true, canViewStatus: true, canModifySettings: true, canConfigurePir: true },
                    principal: { canTurnOn: true, canTurnOff: true, canViewStatus: true, canModifySettings: true, canConfigurePir: true },
                    dean: { canTurnOn: true, canTurnOff: true, canViewStatus: true, canModifySettings: true, canConfigurePir: false },
                    hod: { canTurnOn: true, canTurnOff: true, canViewStatus: true, canModifySettings: true, canConfigurePir: false },
                    faculty: { canTurnOn: true, canTurnOff: true, canViewStatus: true, canModifySettings: true, canConfigurePir: false },
                    security: { canTurnOn: false, canTurnOff: false, canViewStatus: true, canModifySettings: false, canConfigurePir: false },
                    student: { canTurnOn: true, canTurnOff: true, canViewStatus: true, canModifySettings: false, canConfigurePir: false },
                    user: { canTurnOn: true, canTurnOff: true, canViewStatus: true, canModifySettings: false, canConfigurePir: false }
                };
                
                const userRolePermissions = rolePermissions[req.user.role];
                if (!userRolePermissions || !userRolePermissions[requiredPermission]) {
                    return res.status(403).json({
                        message: `Permission denied for role ${req.user.role}: ${requiredPermission}`,
                        code: 'ROLE_PERMISSION_DENIED'
                    });
                }
                
                // Role-based access approved, continue
                return next();
            }
            
            // Reset daily usage if needed
            await permission.resetDailyUsage();
            
            // Check specific permission
            if (!permission.permissions[requiredPermission]) {
                return res.status(403).json({
                    message: `Permission denied: ${requiredPermission}`,
                    code: 'INSUFFICIENT_DEVICE_PERMISSION'
                });
            }
            
            // Check usage limits
            const maxUses = permission.restrictions.maxUsesPerDay;
            if (maxUses && permission.restrictions.usageToday >= maxUses) {
                return res.status(429).json({
                    message: 'Daily usage limit exceeded',
                    code: 'USAGE_LIMIT_EXCEEDED',
                    limit: maxUses,
                    used: permission.restrictions.usageToday
                });
            }
            
            // Check time restrictions
            if (permission.restrictions.allowedTimeSlots.length > 0) {
                const now = new Date();
                const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                const currentTime = now.toTimeString().slice(0, 5); // HH:MM
                
                const isAllowed = permission.restrictions.allowedTimeSlots.some(slot => {
                    return slot.days.includes(currentDay) &&
                           currentTime >= slot.startTime &&
                           currentTime <= slot.endTime;
                });
                
                if (!isAllowed) {
                    return res.status(403).json({
                        message: 'Access not allowed at this time',
                        code: 'TIME_RESTRICTION'
                    });
                }
            }
            
            // Attach permission info for logging
            req.devicePermission = permission;
            next();
            
        } catch (error) {
            console.error('Device permission check error:', error);
            res.status(500).json({
                message: 'Server error during permission check',
                code: 'PERMISSION_CHECK_ERROR'
            });
        }
    };
};

// Middleware to increment usage counter
const incrementUsage = async (req, res, next) => {
    try {
        if (req.devicePermission && req.user.role !== 'admin') {
            req.devicePermission.restrictions.usageToday += 1;
            await req.devicePermission.save();
            
            logger.info(`Device usage incremented: ${req.user.name} used device ${req.devicePermission.device.name}`, {
                userId: req.user._id,
                deviceId: req.devicePermission.device._id,
                usageCount: req.devicePermission.restrictions.usageToday,
                action: 'DEVICE_USAGE'
            });
        }
        next();
    } catch (error) {
        console.error('Usage increment error:', error);
        next(); // Continue even if logging fails
    }
};

// Check value limits (brightness, fan speed, etc.)
const checkValueLimits = async (req, res, next) => {
    try {
        const { brightness, fanSpeed, inputSource } = req.body;
        const permission = req.devicePermission;
        
        if (permission && req.user.role !== 'admin') {
            // Check brightness limit
            if (brightness !== undefined) {
                const maxBrightness = permission.restrictions.maxBrightnessLevel || 100;
                if (brightness > maxBrightness) {
                    return res.status(400).json({
                        message: `Brightness limited to ${maxBrightness}%`,
                        code: 'BRIGHTNESS_LIMIT_EXCEEDED',
                        limit: maxBrightness,
                        requested: brightness
                    });
                }
            }
            
            // Check fan speed limit
            if (fanSpeed !== undefined) {
                const maxSpeed = permission.restrictions.maxFanSpeed || 100;
                if (fanSpeed > maxSpeed) {
                    return res.status(400).json({
                        message: `Fan speed limited to ${maxSpeed}%`,
                        code: 'SPEED_LIMIT_EXCEEDED',
                        limit: maxSpeed,
                        requested: fanSpeed
                    });
                }
            }
            
            // Check allowed input sources
            if (inputSource !== undefined) {
                const allowedSources = permission.restrictions.allowedInputSources;
                if (allowedSources.length > 0 && !allowedSources.includes(inputSource)) {
                    return res.status(400).json({
                        message: 'Input source not allowed',
                        code: 'INPUT_SOURCE_RESTRICTED',
                        allowedSources,
                        requested: inputSource
                    });
                }
            }
        }
        
        next();
    } catch (error) {
        console.error('Value limits check error:', error);
        next();
    }
};

module.exports = {
    checkDevicePermission,
    incrementUsage,
    checkValueLimits
};
