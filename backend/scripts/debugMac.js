const mongoose = require('mongoose');
const Device = require('../models/Device');

async function debugMacAddress() {
  try {
    await mongoose.connect('mongodb://localhost:27017/classroom_automation');
    console.log('Connected to MongoDB');

    // Find all devices and their MAC addresses
    const devices = await Device.find({});
    console.log('\n=== ALL DEVICES IN DATABASE ===');
    devices.forEach((device, index) => {
      console.log(`${index + 1}. Name: ${device.name}`);
      console.log(`   MAC: "${device.macAddress}"`);
      console.log(`   IP: ${device.ipAddress}`);
      console.log(`   ID: ${device._id}`);
      console.log('---');
    });

    // Test the regex match
    const testMac = 'AA:BB:CC:DD:EE:FF';
    console.log(`\n=== TESTING MAC ADDRESS MATCHING ===`);
    console.log(`Looking for MAC: "${testMac}"`);

    // Test exact match
    const exactMatch = await Device.findOne({ macAddress: testMac });
    console.log('Exact match result:', exactMatch ? 'FOUND' : 'NOT FOUND');

    // Test case-insensitive regex
    const regexMatch = await Device.findOne({ macAddress: new RegExp('^' + testMac + '$', 'i') });
    console.log('Regex match result:', regexMatch ? 'FOUND' : 'NOT FOUND');

    // Test lowercase
    const lowerMatch = await Device.findOne({ macAddress: new RegExp('^' + testMac.toLowerCase() + '$', 'i') });
    console.log('Lowercase regex match result:', lowerMatch ? 'FOUND' : 'NOT FOUND');

    // Test different variations
    const variations = [
      'aa:bb:cc:dd:ee:ff',
      'AA:BB:CC:DD:EE:FF',
      'Aa:Bb:Cc:Dd:Ee:Ff'
    ];

    for (const variation of variations) {
      const match = await Device.findOne({ macAddress: new RegExp('^' + variation + '$', 'i') });
      console.log(`Testing "${variation}":`, match ? 'FOUND' : 'NOT FOUND');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

debugMacAddress();
