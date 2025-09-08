const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testDeanToggle() {
    try {
        // Login as dean
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'dean@college.edu',
            password: 'dean123'
        });
        
        const token = loginResponse.data.token;
        const headers = { 'Authorization': `Bearer ${token}` };
        
        console.log('✅ Dean login successful');
        
        // Get devices
        const devicesResponse = await axios.get(`${BASE_URL}/devices`, { headers });
        const devices = devicesResponse.data.data || [];
        
        console.log(`📱 Found ${devices.length} devices`);
        
        if (devices.length === 0) {
            console.log('❌ No devices found to test');
            return;
        }
        
        // Find a device with switches
        const deviceWithSwitches = devices.find(d => d.switches && d.switches.length > 0);
        
        if (!deviceWithSwitches) {
            console.log('❌ No devices with switches found');
            return;
        }
        
        const device = deviceWithSwitches;
        const switchObj = device.switches[0];
        
        console.log(`\n🎯 Testing switch toggle:`);
        console.log(`Device: ${device.name} (ID: ${device._id})`);
        console.log(`Switch: ${switchObj.name} (ID: ${switchObj._id})`);
        console.log(`Current state: ${switchObj.state}`);
        
        // Test toggle
        try {
            const toggleResponse = await axios.post(
                `${BASE_URL}/devices/${device._id}/switches/${switchObj._id}/toggle`,
                { state: !switchObj.state },
                { 
                    headers,
                    timeout: 10000
                }
            );
            
            console.log(`✅ Switch toggle SUCCESS!`);
            console.log(`Response:`, toggleResponse.data);
            
        } catch (error) {
            console.log(`❌ Switch toggle FAILED:`);
            console.log(`Status: ${error.response?.status}`);
            console.log(`Message: ${error.response?.data?.message}`);
            console.log(`Code: ${error.response?.data?.code}`);
            console.log(`Full error data:`, error.response?.data);
        }
        
    } catch (error) {
        console.log(`❌ Test failed:`, error.message);
    }
}

testDeanToggle();
