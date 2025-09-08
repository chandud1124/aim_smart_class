const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function debugDeanAccess() {
    try {
        // Login as dean
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'dean@college.edu',
            password: 'dean123'
        });
        
        const token = loginResponse.data.token;
        const headers = { 'Authorization': `Bearer ${token}` };
        
        console.log('✅ Dean login successful');
        console.log('User details:', {
            name: loginResponse.data.user.name,
            role: loginResponse.data.user.role,
            department: loginResponse.data.user.department,
            assignedDevices: loginResponse.data.user.assignedDevices,
            assignedRooms: loginResponse.data.user.assignedRooms
        });
        
        // Login as admin to see all devices
        const adminLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@college.edu',
            password: 'admin123'
        });
        
        const adminToken = adminLoginResponse.data.token;
        const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };
        
        // Get devices as admin
        const adminDevicesResponse = await axios.get(`${BASE_URL}/devices`, { headers: adminHeaders });
        const allDevices = adminDevicesResponse.data.data || [];
        
        console.log(`\n👑 Admin can see ${allDevices.length} devices:`);
        allDevices.forEach((device, index) => {
            console.log(`${index + 1}. ${device.name} - ${device.classroom} - ${device.macAddress}`);
            console.log(`   Assigned users: ${device.assignedUsers?.length || 0}`);
            console.log(`   Switches: ${device.switches?.length || 0}`);
        });
        
        // Try to get devices as dean
        try {
            const deanDevicesResponse = await axios.get(`${BASE_URL}/devices`, { headers });
            const deanDevices = deanDevicesResponse.data.data || [];
            
            console.log(`\n🎓 Dean can see ${deanDevices.length} devices`);
            if (deanDevices.length === 0) {
                console.log('❌ Dean sees no devices - this is the problem!');
            }
        } catch (error) {
            console.log(`❌ Dean device access error: ${error.response?.status} - ${error.response?.data?.message}`);
        }
        
    } catch (error) {
        console.log(`❌ Test failed:`, error.message);
    }
}

debugDeanAccess();
