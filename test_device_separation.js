const axios = require('axios');

// Test script to verify device type separation
async function testDeviceSeparation() {
  const baseURL = 'http://localhost:3001';

  try {
    console.log('Testing device type separation...');

    // Test 1: Check if /api/devices endpoint exists and returns data
    console.log('\n1. Testing /api/devices endpoint...');
    try {
      const devicesResponse = await axios.get(`${baseURL}/api/devices`);
      console.log('✅ /api/devices endpoint accessible');
      console.log(`   Returned ${devicesResponse.data.data?.length || 0} devices`);

      // Verify all devices are ESP32 devices
      const esp32Devices = devicesResponse.data.data?.filter(d => d.deviceType === 'esp32' || !d.deviceType) || [];
      const otherDevices = devicesResponse.data.data?.filter(d => d.deviceType && d.deviceType !== 'esp32') || [];
      
      if (otherDevices.length === 0) {
        console.log('✅ All devices are ESP32 devices (correct)');
      } else {
        console.log('❌ Found non-ESP32 devices in /api/devices (unexpected):', otherDevices.length);
      }
    } catch (error) {
      console.log('❌ /api/devices endpoint error:', error.message);
    }

    // Test 2: Check if /api/boards endpoint exists and returns data
    console.log('\n2. Testing /api/boards endpoint...');
    try {
      const boardsResponse = await axios.get(`${baseURL}/api/boards`);
      console.log('✅ /api/boards endpoint accessible');
      console.log(`   Returned ${boardsResponse.data.boards?.length || 0} boards`);
    } catch (error) {
      console.log('❌ /api/boards endpoint error:', error.message);
    }

    // Test 3: Check device stats filtering
    console.log('\n3. Testing device stats filtering...');
    try {
      const statsResponse = await axios.get(`${baseURL}/api/devices/stats`);
      console.log('✅ /api/devices/stats endpoint accessible');
      console.log('   Stats:', JSON.stringify(statsResponse.data.data, null, 2));
    } catch (error) {
      console.log('❌ /api/devices/stats endpoint error:', error.message);
    }

    console.log('\n🎉 Device separation test completed!');

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testDeviceSeparation();