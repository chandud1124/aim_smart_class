const axios = require('axios');
const Device = require('../models/Device');
const mongoose = require('mongoose');

async function testDeviceConnection() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/autovolt');
    console.log('Connected to MongoDB');

    // Get the device
    const device = await Device.findOne({ ipAddress: '172.16.3.181' });
    if (!device) {
      console.log('Device not found in database');
      return;
    }

    console.log('\n=== DEVICE INFO ===');
    console.log('Name:', device.name);
    console.log('IP:', device.ipAddress);
    console.log('MAC:', device.macAddress);
    console.log('Status:', device.status);
    console.log('Last Seen:', device.lastSeen);
    console.log('Device ID:', device._id);

    // Test if device is reachable via HTTP
    console.log('\n=== CONNECTIVITY TESTS ===');
    
    try {
      console.log('1. Testing ping to device...');
      const pingResponse = await axios.get(`http://${device.ipAddress}/`, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'AutoVolt-Test'
        }
      });
      console.log('   ✅ Device HTTP server is reachable');
      console.log('   Response status:', pingResponse.status);
    } catch (error) {
      console.log('   ❌ Device HTTP server not reachable:', error.message);
    }

    try {
      console.log('2. Testing device status endpoint...');
      const statusResponse = await axios.get(`http://${device.ipAddress}/status`, { 
        timeout: 5000 
      });
      console.log('   ✅ Device status endpoint working');
      console.log('   Status data:', statusResponse.data);
    } catch (error) {
      console.log('   ❌ Device status endpoint not working:', error.message);
    }

    try {
      console.log('3. Testing device config endpoint...');
      const configResponse = await axios.get(`http://${device.ipAddress}/config`, { 
        timeout: 5000 
      });
      console.log('   ✅ Device config endpoint working');
      console.log('   Config data:', configResponse.data);
    } catch (error) {
      console.log('   ❌ Device config endpoint not working:', error.message);
    }

    // Test if device can reach our backend
    console.log('\n=== BACKEND CONNECTIVITY ===');
    console.log('Backend should be running on: http://localhost:3001');
    
    try {
      const backendResponse = await axios.get('http://localhost:3001/api/health', { 
        timeout: 5000 
      });
      console.log('   ✅ Backend is reachable');
      console.log('   Backend status:', backendResponse.data);
    } catch (error) {
      console.log('   ❌ Backend not reachable:', error.message);
    }

    // Check device configuration endpoint from backend
    try {
      const deviceConfigResponse = await axios.get(`http://localhost:3001/api/esp32/config/${device.macAddress}`, { 
        timeout: 5000 
      });
      console.log('   ✅ Backend device config endpoint working');
      console.log('   Device config from backend:', deviceConfigResponse.data);
    } catch (error) {
      console.log('   ❌ Backend device config endpoint not working:', error.message);
    }

    console.log('\n=== DEVICE REGISTRATION STATUS ===');
    console.log('Device exists in database:', !!device);
    console.log('Device has switches:', device.switches.length);
    console.log('Time since last seen:', device.lastSeen ? 
      Math.floor((new Date() - device.lastSeen) / 1000) + ' seconds' : 'Never');

    // Check if device should be considered online
    const timeSinceLastSeen = device.lastSeen ? new Date() - device.lastSeen : Infinity;
    const shouldBeOnline = timeSinceLastSeen < (2 * 60 * 1000); // 2 minutes
    console.log('Should be considered online:', shouldBeOnline);

    console.log('\n=== RECOMMENDATIONS ===');
    if (!shouldBeOnline) {
      console.log('1. Device needs to send heartbeat to: POST /api/esp32/state/' + device.macAddress);
      console.log('2. Device needs to connect to WebSocket: ws://localhost:3001/esp32-ws');
      console.log('3. Device needs proper authentication with device secret');
    }

    console.log('\n=== ESP32 FIRMWARE REQUIREMENTS ===');
    console.log('The ESP32 firmware should:');
    console.log('1. Connect to WiFi network');
    console.log('2. Make HTTP POST to: http://localhost:3001/api/esp32/state/' + device.macAddress);
    console.log('3. Send JSON body: {"heartbeat": true, "switches": [...]}');
    console.log('4. Send heartbeat every 30-60 seconds');
    console.log('5. Connect to WebSocket: ws://localhost:3001/esp32-ws');

  } catch (error) {
    console.error('Error during connectivity test:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the test
if (require.main === module) {
  testDeviceConnection();
}

module.exports = testDeviceConnection;
