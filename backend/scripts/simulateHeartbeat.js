const axios = require('axios');
const Device = require('../models/Device');
const mongoose = require('mongoose');

async function simulateDeviceHeartbeat() {
  try {
    await mongoose.connect('mongodb://localhost:27017/autovolt');
    console.log('Connected to MongoDB');

    const device = await Device.findOne({ ipAddress: '172.16.3.181' });
    if (!device) {
      console.log('Device not found');
      return;
    }

    console.log('Simulating heartbeat from device:', device.name);
    console.log('MAC Address:', device.macAddress);

    // Send heartbeat to our own backend API
    try {
      const response = await axios.post(`http://localhost:3001/api/esp32/state/${device.macAddress}`, {
        heartbeat: true,
        switches: device.switches.map(sw => ({
          id: sw._id,
          state: sw.state
        }))
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ESP32-Simulator'
        }
      });

      console.log('✅ Heartbeat sent successfully');
      console.log('Response:', response.data);
    } catch (error) {
      console.error('❌ Failed to send heartbeat:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }

    // Check device status after heartbeat
    const updatedDevice = await Device.findOne({ ipAddress: '172.16.3.181' });
    console.log('\n=== DEVICE STATUS AFTER HEARTBEAT ===');
    console.log('Status:', updatedDevice.status);
    console.log('Last Seen:', updatedDevice.lastSeen);
    console.log('Time since last seen:', Math.floor((new Date() - updatedDevice.lastSeen) / 1000), 'seconds ago');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the simulation
if (require.main === module) {
  simulateDeviceHeartbeat();
}

module.exports = simulateDeviceHeartbeat;
