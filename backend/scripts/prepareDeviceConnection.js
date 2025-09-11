const mongoose = require('mongoose');
const Device = require('../models/Device');

async function prepareDeviceForConnection() {
  try {
    await mongoose.connect('mongodb://localhost:27017/autovolt');
    console.log('🔗 Connected to MongoDB');

    // Check current device configuration
    const device = await Device.findOne({ ipAddress: '172.16.3.181' });
    
    if (!device) {
      console.log('❌ Device with IP 172.16.3.181 not found in database');
      console.log('   Run: node scripts/addDevice.js first');
      return;
    }

    console.log('\n📱 Current Device Configuration:');
    console.log(`   Name: ${device.name}`);
    console.log(`   IP: ${device.ipAddress}`);
    console.log(`   MAC: ${device.macAddress}`);
    console.log(`   Status: ${device.status}`);
    console.log(`   Last Seen: ${device.lastSeen}`);
    console.log(`   Switches: ${device.switches.length}`);

    // Update the MAC address to a more realistic one for the target device
    const newMacAddress = 'AC:67:B2:3F:8E:91'; // More realistic MAC for device at 172.16.3.181
    
    console.log('\n🔄 Updating device configuration...');
    device.macAddress = newMacAddress;
    device.status = 'offline';
    device.lastSeen = new Date();
    
    await device.save();
    
    console.log('✅ Device updated successfully');
    console.log(`   New MAC: ${device.macAddress}`);
    
    console.log('\n🎯 ESP32 Configuration Required:');
    console.log('   Update this line in improved_esp32.cpp:');
    console.log(`   // When ESP32 connects, it should report MAC: ${newMacAddress}`);
    console.log('   // Backend expects this MAC address for device identification');
    
    console.log('\n📋 WebSocket Connection Test:');
    console.log('   Backend WebSocket endpoint: ws://172.16.3.171:3001/esp32-ws');
    console.log('   Expected identify message:');
    console.log(`   {`);
    console.log(`     "type": "identify",`);
    console.log(`     "mac": "${newMacAddress}",`);
    console.log(`     "secret": "6af44c010af8ba58514c6fa989c6e6d3469068f2d8da19a4"`);
    console.log(`   }`);
    
    console.log('\n🔍 How to verify connection:');
    console.log('   1. Flash ESP32 with updated firmware');
    console.log('   2. Monitor Serial output for WiFi connection');
    console.log('   3. Watch backend logs for WebSocket connection');
    console.log('   4. Check Active Logs page for device appearing as online');
    console.log('   5. Test switch controls from web interface');

    // Test backend API endpoint
    console.log('\n🧪 Testing Backend API...');
    try {
      const axios = require('axios');
      const response = await axios.get(`http://localhost:3001/api/esp32/config/${device.macAddress}`);
      console.log('✅ Backend API responding correctly');
      console.log(`   Device config endpoint working: /api/esp32/config/${device.macAddress}`);
    } catch (error) {
      console.log('❌ Backend API test failed:', error.message);
      console.log('   Make sure backend server is running on port 3001');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the preparation
if (require.main === module) {
  prepareDeviceForConnection();
}

module.exports = prepareDeviceForConnection;
