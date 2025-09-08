const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Test role permissions for different users
async function testRolePermissions() {
    console.log('🧪 Testing Role Permissions System\n');

    // Test data - you can modify these based on actual users in your system
    const testUsers = [
        { email: 'admin@college.edu', role: 'admin', password: 'admin123' },
        { email: 'dean@college.edu', role: 'dean', password: 'dean123' },
        { email: 'hod@college.edu', role: 'hod', password: 'hod123' },
        { email: 'faculty@college.edu', role: 'faculty', password: 'faculty123' },
        { email: 'student@college.edu', role: 'student', password: 'student123' },
    ];

    for (const testUser of testUsers) {
        console.log(`\n📋 Testing ${testUser.role.toUpperCase()} permissions:`);
        
        try {
            // Login
            const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
                email: testUser.email,
                password: testUser.password
            });
            
            if (loginResponse.status !== 200) {
                console.log(`❌ Login failed for ${testUser.role}: ${loginResponse.status}`);
                continue;
            }
            
            const token = loginResponse.data.token;
            const headers = { 'Authorization': `Bearer ${token}` };
            
            console.log(`✅ Login successful for ${testUser.role}`);
            
            // Test device access
            try {
                const devicesResponse = await axios.get(`${BASE_URL}/devices`, { headers });
                console.log(`✅ Can view devices: ${devicesResponse.data.data?.length || 0} devices visible`);
            } catch (error) {
                console.log(`❌ Cannot view devices: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            }
            
            // Test switch toggle (if devices exist)
            try {
                const devicesResponse = await axios.get(`${BASE_URL}/devices`, { headers });
                if (devicesResponse.data.data && devicesResponse.data.data.length > 0) {
                    const firstDevice = devicesResponse.data.data[0];
                    if (firstDevice.switches && firstDevice.switches.length > 0) {
                        const deviceId = firstDevice._id;
                        const switchId = firstDevice.switches[0]._id;
                        
                        const toggleResponse = await axios.post(
                            `${BASE_URL}/devices/${deviceId}/switches/${switchId}/toggle`,
                            { state: true },
                            { headers }
                        );
                        console.log(`✅ Can toggle switches: Switch toggled successfully`);
                    } else {
                        console.log(`⚠️  No switches found on first device`);
                    }
                } else {
                    console.log(`⚠️  No devices found to test switch toggle`);
                }
            } catch (error) {
                console.log(`❌ Cannot toggle switches: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            }
            
            // Test bulk toggle
            try {
                const bulkResponse = await axios.post(
                    `${BASE_URL}/devices/bulk-toggle`,
                    { state: true, deviceIds: [] },
                    { headers }
                );
                console.log(`✅ Can bulk toggle: Bulk operation allowed`);
            } catch (error) {
                console.log(`❌ Cannot bulk toggle: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            }
            
            // Test user management (admin/management only)
            try {
                const usersResponse = await axios.get(`${BASE_URL}/users`, { headers });
                console.log(`✅ Can view users: ${usersResponse.data.data?.length || 0} users visible`);
            } catch (error) {
                console.log(`❌ Cannot view users: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            }
            
        } catch (error) {
            console.log(`❌ Login failed for ${testUser.role}: ${error.response?.data?.message || error.message}`);
        }
    }
    
    console.log('\n🏁 Role permission testing completed');
}

// Test specific dean user if it exists
async function testDeanSpecifically() {
    console.log('\n🎯 Testing Dean Role Specifically\n');
    
    try {
        // Try to login as dean
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'dean@college.edu',
            password: 'dean123'
        });
        
        const token = loginResponse.data.token;
        const headers = { 'Authorization': `Bearer ${token}` };
        
        console.log('✅ Dean login successful');
        console.log(`User details:`, {
            name: loginResponse.data.user.name,
            role: loginResponse.data.user.role,
            department: loginResponse.data.user.department,
            isActive: loginResponse.data.user.isActive,
            isApproved: loginResponse.data.user.isApproved
        });
        
        // Test all device endpoints that dean should have access to
        const testEndpoints = [
            { method: 'GET', path: '/devices', desc: 'View devices' },
            { method: 'GET', path: '/devices/stats', desc: 'View device stats' },
        ];
        
        for (const endpoint of testEndpoints) {
            try {
                const response = await axios({
                    method: endpoint.method.toLowerCase(),
                    url: `${BASE_URL}${endpoint.path}`,
                    headers
                });
                console.log(`✅ ${endpoint.desc}: Success (${response.status})`);
            } catch (error) {
                console.log(`❌ ${endpoint.desc}: Failed (${error.response?.status}) - ${error.response?.data?.message}`);
            }
        }
        
        // Test switch toggle with first available device
        try {
            const devicesResponse = await axios.get(`${BASE_URL}/devices`, { headers });
            if (devicesResponse.data.data && devicesResponse.data.data.length > 0) {
                const device = devicesResponse.data.data[0];
                console.log(`\nTesting with device: ${device.name} (${device._id})`);
                
                if (device.switches && device.switches.length > 0) {
                    const switchId = device.switches[0]._id;
                    console.log(`Testing switch: ${device.switches[0].name} (${switchId})`);
                    
                    const toggleResponse = await axios.post(
                        `${BASE_URL}/devices/${device._id}/switches/${switchId}/toggle`,
                        { state: !device.switches[0].state },
                        { headers }
                    );
                    console.log(`✅ Switch toggle successful: ${toggleResponse.data.message || 'Toggle completed'}`);
                } else {
                    console.log(`⚠️  Device has no switches to test`);
                }
            }
        } catch (error) {
            console.log(`❌ Switch toggle failed: ${error.response?.status} - ${error.response?.data?.message}`);
            console.log('Error details:', error.response?.data);
        }
        
    } catch (error) {
        console.log(`❌ Dean test failed: ${error.response?.data?.message || error.message}`);
    }
}

// Run the tests
async function main() {
    console.log('🚀 Starting Role Permission Tests\n');
    
    // First test dean specifically
    await testDeanSpecifically();
    
    // Then test all roles
    // await testRolePermissions();
}

main().catch(console.error);
