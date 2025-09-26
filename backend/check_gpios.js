const mongoose = require('mongoose');
require('dotenv').config();

async function checkDeviceGPIOs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');

    const Device = require('./models/Device');
    const devices = await Device.find({}, 'name macAddress switches');

    console.log('=== DEVICE GPIO CONFIGURATION ===');
    devices.forEach(device => {
      console.log(`${device.name} (${device.macAddress}):`);
      device.switches.forEach((sw, index) => {
        console.log(`  Switch ${index + 1}: GPIO ${sw.gpio}, Type: ${sw.type}`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkDeviceGPIOs();