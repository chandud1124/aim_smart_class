// Demo script showing how the limited control system works
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Test users with different permission levels
const testUsers = {
    admin: {
        email: 'admin@iotclassroom.com',
        password: 'admin123',
        expectedPermissions: 'full'
    },
    limitedUser: {
        email: 'student@test.com',
        password: 'password123',
        expectedPermissions: 'limited'
    },
    readonlyUser: {
        email: 'observer@test.com',
        password: 'password123',
        expectedPermissions: 'readonly'
    }
};

async function loginUser(credentials) {
    try {
        const response = await axios.post(`${API_BASE}/auth/login`, credentials);
        return response.data.token;
    } catch (error) {
        console.error(`Login failed for ${credentials.email}:`, error.response?.data?.message);
        return null;
    }
}

async function testDeviceAccess(token, deviceId, action) {
    try {
        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };
        
        let response;
        
        switch (action) {
            case 'view':
                response = await axios.get(`${API_BASE}/devices/${deviceId}/status`, config);
                break;
            case 'toggle':
                response = await axios.post(`${API_BASE}/devices/${deviceId}/switches/1/toggle`, 
                    { state: true }, config);
                break;
            case 'configure':
                response = await axios.post(`${API_BASE}/devices/${deviceId}/pir/configure`, 
                    { enabled: true, sensitivity: 80 }, config);
                break;
            case 'control':
                response = await axios.post(`${API_BASE}/devices/${deviceId}/control`, 
                    { brightness: 50, fanSpeed: 30 }, config);
                break;
            default:
                throw new Error('Unknown action');
        }
        
        return { success: true, data: response.data };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data?.message || error.message,
            code: error.response?.data?.code
        };
    }
}

async function demonstratePermissionSystem() {
    console.log('=== IoT Classroom Limited Control System Demo ===\n');
    
    // First, let's get a device to test with
    console.log('1. Getting available devices...');
    try {
        const adminToken = await loginUser(testUsers.admin);
        if (!adminToken) return;
        
        const devicesResponse = await axios.get(`${API_BASE}/devices`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        if (!devicesResponse.data.data || devicesResponse.data.data.length === 0) {
            console.log('No devices found. Please add some devices first.');
            return;
        }
        
        const testDevice = devicesResponse.data.data[0];
        console.log(`Using device: ${testDevice.name} (${testDevice._id})\n`);
        
        // Create limited permissions for test users
        console.log('2. Setting up limited permissions...');
        
        // Grant limited permissions to a student
        await axios.post(`${API_BASE}/device-permissions/grant`, {
            userId: 'STUDENT_USER_ID', // Replace with actual user ID
            deviceId: testDevice._id,
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
                maxUsesPerDay: 10,
                maxBrightnessLevel: 60,
                maxFanSpeed: 50,
                allowedTimeSlots: [{
                    startTime: '08:00',
                    endTime: '18:00',
                    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                }]
            },
            reason: 'Limited classroom access for student'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        console.log('Limited permissions granted to student\n');
        
        // Test different permission levels
        console.log('3. Testing different access levels...\n');
        
        for (const [userType, userInfo] of Object.entries(testUsers)) {
            console.log(`--- Testing ${userType.toUpperCase()} Access ---`);
            
            const token = await loginUser(userInfo);
            if (!token) continue;
            
            // Test basic operations
            const operations = [
                { name: 'View Status', action: 'view' },
                { name: 'Toggle Switch', action: 'toggle' },
                { name: 'Configure PIR', action: 'configure' },
                { name: 'Control Settings', action: 'control' }
            ];
            
            for (const op of operations) {
                const result = await testDeviceAccess(token, testDevice._id, op.action);
                
                if (result.success) {
                    console.log(`  ✅ ${op.name}: SUCCESS`);
                } else {
                    console.log(`  ❌ ${op.name}: ${result.error} (${result.code})`);
                }
            }
            
            console.log();
        }
        
        // Demonstrate usage limits
        console.log('4. Testing usage limits...');
        const limitedToken = await loginUser(testUsers.limitedUser);
        if (limitedToken) {
            console.log('Simulating multiple device toggles to test daily limit...');
            
            for (let i = 1; i <= 12; i++) {
                const result = await testDeviceAccess(limitedToken, testDevice._id, 'toggle');
                
                if (result.success) {
                    console.log(`  Toggle ${i}: SUCCESS`);
                } else {
                    console.log(`  Toggle ${i}: FAILED - ${result.error}`);
                    if (result.code === 'USAGE_LIMIT_EXCEEDED') {
                        console.log('  Daily usage limit reached!');
                        break;
                    }
                }
            }
        }
        
        console.log('\n5. Testing time restrictions...');
        console.log('Note: Time restrictions are checked in real-time based on current time and allowed slots.');
        
        console.log('\n=== Demo Complete ===');
        console.log('\nKey Features Demonstrated:');
        console.log('• Role-based access control');
        console.log('• Device-specific permissions');
        console.log('• Usage limits (daily maximum)');
        console.log('• Time-based restrictions');
        console.log('• Value limits (brightness, fan speed)');
        console.log('• PIR sensor access control');
        console.log('• Temporary admin overrides');
        
    } catch (error) {
        console.error('Demo failed:', error.message);
    }
}

// Additional utility functions for permission management
async function showPermissionPresets() {
    console.log('\n=== Permission Presets ===');
    
    const presets = {
        student: {
            name: 'Student (Basic Access)',
            permissions: {
                canTurnOn: true,
                canTurnOff: true,
                canViewStatus: true,
                canSchedule: false,
                canModifySettings: false,
                canConfigurePir: false
            },
            restrictions: {
                maxUsesPerDay: 5,
                maxBrightnessLevel: 60,
                maxFanSpeed: 50,
                allowedTimeSlots: [{ 
                    startTime: '08:00', 
                    endTime: '17:00', 
                    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] 
                }]
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
                canConfigurePir: false
            },
            restrictions: {
                maxUsesPerDay: null, // Unlimited
                maxBrightnessLevel: 100,
                maxFanSpeed: 100,
                allowedTimeSlots: [] // No time restrictions
            }
        },
        maintenance: {
            name: 'Maintenance (Technical Access)',
            permissions: {
                canTurnOn: true,
                canTurnOff: true,
                canViewStatus: true,
                canSchedule: false,
                canModifySettings: true,
                canConfigurePir: true,
                canViewHistory: true
            },
            restrictions: {
                maxUsesPerDay: null,
                maxBrightnessLevel: 100,
                maxFanSpeed: 100,
                allowedTimeSlots: []
            }
        },
        visitor: {
            name: 'Visitor (View Only)',
            permissions: {
                canTurnOn: false,
                canTurnOff: false,
                canViewStatus: true,
                canSchedule: false,
                canModifySettings: false,
                canConfigurePir: false
            },
            restrictions: {
                maxUsesPerDay: 0, // No control allowed
                maxBrightnessLevel: 0,
                maxFanSpeed: 0,
                allowedTimeSlots: []
            }
        }
    };
    
    for (const [key, preset] of Object.entries(presets)) {
        console.log(`\n${preset.name}:`);
        console.log('  Permissions:', JSON.stringify(preset.permissions, null, 4));
        console.log('  Restrictions:', JSON.stringify(preset.restrictions, null, 4));
    }
}

// Run the demo
if (require.main === module) {
    demonstratePermissionSystem()
        .then(() => showPermissionPresets())
        .catch(console.error);
}

module.exports = {
    demonstratePermissionSystem,
    showPermissionPresets,
    testDeviceAccess,
    loginUser
};
