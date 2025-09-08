const mongoose = require('mongoose');
const Device = require('../models/Device');

async function addDevice() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/classroom_automation', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Create the device with IP 172.16.3.181
    const deviceData = {
      name: 'Smart Classroom Controller',
      macAddress: 'AA:BB:CC:DD:EE:FF', // You'll need the actual MAC address
      ipAddress: '172.16.3.181',
      location: 'Classroom A1',
      classroom: 'A1',
      status: 'offline',
      switches: [
        {
          name: 'Fan 1',
          gpio: 4,
          type: 'fan',
          state: false,
          icon: 'fan'
        },
        {
          name: 'Fan 2',
          gpio: 5,
          type: 'fan',
          state: false,
          icon: 'fan'
        },
        {
          name: 'Light 1',
          gpio: 18,
          type: 'light',
          state: false,
          icon: 'lightbulb'
        },
        {
          name: 'Light 2',
          gpio: 19,
          type: 'light',
          state: false,
          icon: 'lightbulb'
        },
        {
          name: 'Projector',
          gpio: 21,
          type: 'projector',
          state: false,
          icon: 'projector'
        },
        {
          name: 'Air Conditioner',
          gpio: 22,
          type: 'ac',
          state: false,
          icon: 'snowflake'
        }
      ],
      pirEnabled: false,
      lastSeen: new Date()
    };

    // Check if device already exists
    const existingDevice = await Device.findOne({ ipAddress: '172.16.3.181' });
    if (existingDevice) {
      console.log('Device with IP 172.16.3.181 already exists:', existingDevice.name);
      return;
    }

    // Create the device
    const device = new Device(deviceData);
    const savedDevice = await device.save();
    
    console.log('Device added successfully:');
    console.log('- Name:', savedDevice.name);
    console.log('- IP Address:', savedDevice.ipAddress);
    console.log('- MAC Address:', savedDevice.macAddress);
    console.log('- Location:', savedDevice.location);
    console.log('- Switches:', savedDevice.switches.length);
    console.log('- Device ID:', savedDevice._id);

  } catch (error) {
    console.error('Error adding device:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
if (require.main === module) {
  addDevice();
}

module.exports = addDevice;
