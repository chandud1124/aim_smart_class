const DevicePermission = require('../models/DevicePermission');
const Device = require('../models/Device');
const User = require('../models/User');
const { logger } = require('../middleware/logger');

// Grant device-specific permissions to a user
const grantDevicePermission = async (req, res) => {
    try {
        const {
            userId,
            deviceId,
            permissions,
            restrictions,
            expiresAt,
            reason
        } = req.body;

        // Validate required fields
        if (!userId || !deviceId) {
            return res.status(400).json({
                message: 'User ID and Device ID are required'
            });
        }

        // Check if user and device exist
        const [user, device] = await Promise.all([
            User.findById(userId),
            Device.findById(deviceId)
        ]);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // Check if permission already exists
        const existingPermission = await DevicePermission.findOne({
            user: userId,
            device: deviceId,
            isActive: true
        });

        if (existingPermission) {
            return res.status(400).json({
                message: 'User already has permission for this device'
            });
        }

        // Create new device permission
        const devicePermission = new DevicePermission({
            user: userId,
            device: deviceId,
            classroom: device.classroom,
            permissions: permissions || {
                canTurnOn: true,
                canTurnOff: true,
                canViewStatus: true,
                canSchedule: false,
                canModifySettings: false,
                canViewHistory: false,
                canAdjustBrightness: false,
                canAdjustSpeed: false,
                canChangeInput: false,
                canConfigurePir: false,
                canViewPirData: true,
                canDisablePir: false
            },
            restrictions: restrictions || {
                maxUsesPerDay: null,
                allowedTimeSlots: [],
                maxBrightnessLevel: 100,
                maxFanSpeed: 100,
                allowedInputSources: []
            },
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            grantedBy: req.user._id,
            reason
        });

        await devicePermission.save();

        // Populate the response
        await devicePermission.populate([
            { path: 'user', select: 'name email role' },
            { path: 'device', select: 'name type classroom' },
            { path: 'grantedBy', select: 'name email role' }
        ]);

        logger.info(`Device permission granted: ${req.user.name} granted ${user.name} access to device ${device.name}`, {
            action: 'GRANT_DEVICE_PERMISSION',
            grantedBy: req.user._id,
            userId,
            deviceId,
            permissions: devicePermission.permissions
        });

        res.status(201).json({
            success: true,
            data: devicePermission
        });
    } catch (error) {
        console.error('Grant device permission error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all device permissions for a user
const getUserDevicePermissions = async (req, res) => {
    try {
        const { userId } = req.params;

        // Only admins or the user themselves can view their permissions
        if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const permissions = await DevicePermission.find({
            user: userId,
            isActive: true,
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: { $gt: new Date() } }
            ]
        }).populate([
            { path: 'device', select: 'name type classroom mac location' },
            { path: 'grantedBy', select: 'name email role' }
        ]);

        res.json({
            success: true,
            data: permissions
        });
    } catch (error) {
        console.error('Get user device permissions error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update device permission
const updateDevicePermission = async (req, res) => {
    try {
        const { permissionId } = req.params;
        const { permissions, restrictions, expiresAt, reason } = req.body;

        const permission = await DevicePermission.findById(permissionId);
        if (!permission) {
            return res.status(404).json({ message: 'Permission not found' });
        }

        // Only admin or the person who granted can update
        if (req.user.role !== 'admin' && 
            permission.grantedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this permission' });
        }

        // Update fields
        if (permissions) permission.permissions = { ...permission.permissions, ...permissions };
        if (restrictions) permission.restrictions = { ...permission.restrictions, ...restrictions };
        if (expiresAt) permission.expiresAt = new Date(expiresAt);
        if (reason) permission.reason = reason;

        await permission.save();

        await permission.populate([
            { path: 'user', select: 'name email role' },
            { path: 'device', select: 'name type classroom' },
            { path: 'grantedBy', select: 'name email role' }
        ]);

        logger.info(`Device permission updated: ${req.user.name} updated permission for device ${permission.device.name}`, {
            action: 'UPDATE_DEVICE_PERMISSION',
            updatedBy: req.user._id,
            permissionId,
            permissions: permission.permissions
        });

        res.json({
            success: true,
            data: permission
        });
    } catch (error) {
        console.error('Update device permission error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Revoke device permission
const revokeDevicePermission = async (req, res) => {
    try {
        const { permissionId } = req.params;

        const permission = await DevicePermission.findById(permissionId);
        if (!permission) {
            return res.status(404).json({ message: 'Permission not found' });
        }

        // Only admin or the person who granted can revoke
        if (req.user.role !== 'admin' && 
            permission.grantedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to revoke this permission' });
        }

        permission.isActive = false;
        await permission.save();

        logger.info(`Device permission revoked: ${req.user.name} revoked permission for device ${permission.device}`, {
            action: 'REVOKE_DEVICE_PERMISSION',
            revokedBy: req.user._id,
            permissionId
        });

        res.json({
            success: true,
            message: 'Permission revoked successfully'
        });
    } catch (error) {
        console.error('Revoke device permission error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get device permissions summary for admin
const getDevicePermissionsSummary = async (req, res) => {
    try {
        const { classroom } = req.query;
        let filter = { isActive: true };
        
        if (classroom) {
            filter.classroom = classroom;
        }

        const permissions = await DevicePermission.find(filter).populate([
            { path: 'user', select: 'name email role department' },
            { path: 'device', select: 'name type classroom mac' },
            { path: 'grantedBy', select: 'name email role' }
        ]);

        // Group by device
        const summary = {};
        permissions.forEach(perm => {
            const deviceId = perm.device._id.toString();
            if (!summary[deviceId]) {
                summary[deviceId] = {
                    device: perm.device,
                    permissions: []
                };
            }
            summary[deviceId].permissions.push({
                _id: perm._id,
                user: perm.user,
                permissions: perm.permissions,
                restrictions: perm.restrictions,
                grantedBy: perm.grantedBy,
                grantedAt: perm.createdAt,
                expiresAt: perm.expiresAt
            });
        });

        res.json({
            success: true,
            data: Object.values(summary)
        });
    } catch (error) {
        console.error('Get device permissions summary error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Grant temporary override
const grantTemporaryOverride = async (req, res) => {
    try {
        const { permissionId } = req.params;
        const { durationMinutes, reason } = req.body;

        const permission = await DevicePermission.findById(permissionId);
        if (!permission) {
            return res.status(404).json({ message: 'Permission not found' });
        }

        // Only admin can grant temporary overrides
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admin can grant temporary overrides' });
        }

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + (durationMinutes || 60));

        permission.temporaryOverrides = {
            enabled: true,
            expiresAt,
            reason: reason || 'Temporary override granted by admin',
            grantedBy: req.user._id
        };

        await permission.save();

        logger.info(`Temporary override granted: ${req.user.name} granted override for ${durationMinutes} minutes`, {
            action: 'GRANT_TEMPORARY_OVERRIDE',
            grantedBy: req.user._id,
            permissionId,
            durationMinutes,
            expiresAt
        });

        res.json({
            success: true,
            message: 'Temporary override granted',
            expiresAt
        });
    } catch (error) {
        console.error('Grant temporary override error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    grantDevicePermission,
    getUserDevicePermissions,
    updateDevicePermission,
    revokeDevicePermission,
    getDevicePermissionsSummary,
    grantTemporaryOverride
};
