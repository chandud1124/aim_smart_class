const mongoose = require('mongoose');

// Use the same connection as the server
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom';

async function checkDevices() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const Device = require('./backend/models/Device');

    // Get all ESP32 devices
    const devices = await Device.find({deviceType: 'esp32'}).select('macAddress deviceType deviceSecret status');

    console.log(`Found ${devices.length} ESP32 devices:`);
    devices.forEach((d, i) => {
      console.log(`${i+1}. MAC: "${d.macAddress}", Type: ${d.deviceType}, Status: ${d.status}`);
      console.log(`   Secret length: ${d.deviceSecret ? d.deviceSecret.length : 'none'}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDevices();