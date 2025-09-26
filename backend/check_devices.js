const mongoose = require('mongoose');
require('dotenv').config();

async function checkDevices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');

    const Device = require('./models/Device');
    const devices = await Device.find({}, 'name macAddress status lastSeen switches');

    console.log('=== DEVICE CONNECTIVITY STATUS ===');
    devices.forEach(device => {
      const lastSeen = device.lastSeen ? new Date(device.lastSeen).toISOString() : 'Never';
      const timeSinceLastSeen = device.lastSeen ? Date.now() - new Date(device.lastSeen).getTime() : Infinity;
      const isOnline = timeSinceLastSeen < 120000; // 2 minutes

      console.log(`${device.name} (${device.macAddress}):`);
      console.log(`  Status: ${device.status}`);
      console.log(`  Last Seen: ${lastSeen}`);
      console.log(`  Is Online: ${isOnline ? 'YES' : 'NO'}`);
      console.log(`  Switches: ${device.switches.length}`);
      console.log('');
    });

    console.log(`Total devices: ${devices.length}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkDevices();