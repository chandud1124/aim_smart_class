const mongoose = require('mongoose');
const DevicePermission = require('../models/DevicePermission');
const Device = require('../models/Device');
const User = require('../models/User');

async function setupDefaultPermissions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');
        console.log('Connected to MongoDB');

        // Get all devices
        const devices = await Device.find({});
        console.log(`Found ${devices.length} devices`);

        // Get all users
        const users = await User.find({ isActive: true });
        console.log(`Found ${users.length} active users`);

        // Define default permission presets
        const permissionPresets = {
            student: {
                name: 'Student (Basic Access)',
                permissions: {
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
                restrictions: {
                    maxUsesPerDay: 5,
                    maxBrightnessLevel: 60,
                    maxFanSpeed: 50,
                    allowedTimeSlots: [{
                        startTime: '08:00',
                        endTime: '17:00',
                        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                    }],
                    allowedInputSources: []
                }
            },
            faculty: {
                name: 'Faculty (Teaching Access)',
                permissions: {
                    canTurnOn: true,
                    canTurnOff: true,
                    canViewStatus: true,
                    canSchedule: true,
                    canModifySettings: true,
                    canViewHistory: true,
                    canAdjustBrightness: true,
                    canAdjustSpeed: true,
                    canChangeInput: false,
                    canConfigurePir: false,
                    canViewPirData: true,
                    canDisablePir: false
                },
                restrictions: {
                    maxUsesPerDay: null, // Unlimited
                    maxBrightnessLevel: 100,
                    maxFanSpeed: 100,
                    allowedTimeSlots: [], // No time restrictions
                    allowedInputSources: []
                }
            },
            hod: {
                name: 'HOD (Department Access)',
                permissions: {
                    canTurnOn: true,
                    canTurnOff: true,
                    canViewStatus: true,
                    canSchedule: true,
                    canModifySettings: true,
                    canViewHistory: true,
                    canAdjustBrightness: true,
                    canAdjustSpeed: true,
                    canChangeInput: true,
                    canConfigurePir: true,
                    canViewPirData: true,
                    canDisablePir: true
                },
                restrictions: {
                    maxUsesPerDay: null,
                    maxBrightnessLevel: 100,
                    maxFanSpeed: 100,
                    allowedTimeSlots: [],
                    allowedInputSources: ['HDMI1', 'HDMI2', 'VGA', 'DisplayPort']
                }
            },
            dean: {
                name: 'Dean (Administrative Access)',
                permissions: {
                    canTurnOn: true,
                    canTurnOff: true,
                    canViewStatus: true,
                    canSchedule: true,
                    canModifySettings: true,
                    canViewHistory: true,
                    canAdjustBrightness: true,
                    canAdjustSpeed: true,
                    canChangeInput: true,
                    canConfigurePir: true,
                    canViewPirData: true,
                    canDisablePir: true
                },
                restrictions: {
                    maxUsesPerDay: null,
                    maxBrightnessLevel: 100,
                    maxFanSpeed: 100,
                    allowedTimeSlots: [],
                    allowedInputSources: ['HDMI1', 'HDMI2', 'VGA', 'DisplayPort', 'USB-C']
                }
            },
            security: {
                name: 'Security (Monitoring Access)',
                permissions: {
                    canTurnOn: false,
                    canTurnOff: false,
                    canViewStatus: true,
                    canSchedule: false,
                    canModifySettings: false,
                    canViewHistory: true,
                    canAdjustBrightness: false,
                    canAdjustSpeed: false,
                    canChangeInput: false,
                    canConfigurePir: true,
                    canViewPirData: true,
                    canDisablePir: false
                },
                restrictions: {
                    maxUsesPerDay: 0,
                    maxBrightnessLevel: 0,
                    maxFanSpeed: 0,
                    allowedTimeSlots: [],
                    allowedInputSources: []
                }
            }
        };

        console.log('\n=== SETTING UP DEFAULT PERMISSIONS ===');

        let permissionsCreated = 0;
        let permissionsSkipped = 0;

        // Create permissions for each user based on their role
        for (const user of users) {
            const userRole = user.role;
            const preset = permissionPresets[userRole];

            if (!preset) {
                console.log(`⚠️  No preset found for role: ${userRole} (user: ${user.name})`);
                continue;
            }

            // Create permissions for devices in user's department or assigned rooms
            for (const device of devices) {
                // Check if user should have access to this device
                let shouldHaveAccess = false;

                if (userRole === 'admin' || userRole === 'principal') {
                    // Admins have access to all devices
                    shouldHaveAccess = true;
                } else if (user.department && device.classroom) {
                    // Department-based access for faculty, HOD, dean
                    const deptMatch = device.classroom.toLowerCase().includes(user.department.toLowerCase());
                    shouldHaveAccess = deptMatch;
                } else if (user.assignedRooms && user.assignedRooms.length > 0) {
                    // Room-based access
                    shouldHaveAccess = user.assignedRooms.some(room =>
                        device.classroom && device.classroom.includes(room)
                    );
                }

                if (!shouldHaveAccess) {
                    continue;
                }

                // Check if permission already exists
                const existingPermission = await DevicePermission.findOne({
                    user: user._id,
                    device: device._id,
                    isActive: true
                });

                if (existingPermission) {
                    permissionsSkipped++;
                    continue;
                }

                // Create new permission
                const permission = new DevicePermission({
                    user: user._id,
                    device: device._id,
                    classroom: device.classroom,
                    permissions: preset.permissions,
                    restrictions: preset.restrictions,
                    grantedBy: user._id, // Self-granted for default setup
                    reason: `Default ${preset.name} permissions`
                });

                await permission.save();
                permissionsCreated++;

                console.log(`✅ Created ${preset.name} permission: ${user.name} -> ${device.name}`);
            }
        }

        console.log(`\n=== PERMISSION SETUP COMPLETE ===`);
        console.log(`📊 Permissions created: ${permissionsCreated}`);
        console.log(`⏭️  Permissions skipped (already exist): ${permissionsSkipped}`);

        // Display permission summary
        console.log('\n=== PERMISSION SUMMARY ===');
        const summary = await DevicePermission.aggregate([
            {
                $group: {
                    _id: '$classroom',
                    count: { $sum: 1 },
                    users: { $addToSet: '$user' }
                }
            },
            { $sort: { count: -1 } }
        ]);

        summary.forEach(item => {
            console.log(`${item._id}: ${item.count} permissions (${item.users.length} users)`);
        });

    } catch (error) {
        console.error('❌ Error setting up default permissions:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Additional utility functions
async function createCustomPermission(userId, deviceId, customPermissions, customRestrictions, reason) {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');

        const permission = new DevicePermission({
            user: userId,
            device: deviceId,
            permissions: customPermissions,
            restrictions: customRestrictions,
            grantedBy: userId,
            reason: reason || 'Custom permission'
        });

        await permission.save();
        console.log('✅ Custom permission created');

        await mongoose.disconnect();
        return permission;
    } catch (error) {
        console.error('❌ Error creating custom permission:', error);
        await mongoose.disconnect();
        throw error;
    }
}

async function listUserPermissions(userId) {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');

        const permissions = await DevicePermission.find({
            user: userId,
            isActive: true
        }).populate('device', 'name classroom type');

        console.log(`\n=== PERMISSIONS FOR USER ${userId} ===`);
        permissions.forEach((perm, index) => {
            console.log(`${index + 1}. ${perm.device.name} (${perm.device.classroom})`);
            console.log(`   Permissions: ${Object.keys(perm.permissions).filter(k => perm.permissions[k]).join(', ')}`);
            console.log(`   Restrictions: ${perm.restrictions.maxUsesPerDay ? `Max ${perm.restrictions.maxUsesPerDay}/day` : 'Unlimited'}`);
            console.log('---');
        });

        await mongoose.disconnect();
        return permissions;
    } catch (error) {
        console.error('❌ Error listing user permissions:', error);
        await mongoose.disconnect();
        throw error;
    }
}

// CLI Interface
if (require.main === module) {
    const command = process.argv[2];

    switch (command) {
        case 'setup':
            setupDefaultPermissions();
            break;
        case 'custom':
            const [,, userId, deviceId, permissions, restrictions, reason] = process.argv;
            createCustomPermission(userId, deviceId, JSON.parse(permissions), JSON.parse(restrictions), reason);
            break;
        case 'list':
            const [,, userIdToList] = process.argv;
            if (!userIdToList) {
                console.log('Usage: node setup-permissions.js list <userId>');
                process.exit(1);
            }
            listUserPermissions(userIdToList);
            break;
        default:
            console.log('Permission Setup Utility');
            console.log('Usage: node setup-permissions.js <command>');
            console.log('');
            console.log('Commands:');
            console.log('  setup     - Set up default permissions for all users');
            console.log('  custom    - Create custom permission');
            console.log('  list      - List permissions for a user');
            console.log('');
            console.log('Examples:');
            console.log('  node setup-permissions.js setup');
            console.log('  node setup-permissions.js list 507f1f77bcf86cd799439011');
            break;
    }
}

module.exports = {
    setupDefaultPermissions,
    createCustomPermission,
    listUserPermissions
};