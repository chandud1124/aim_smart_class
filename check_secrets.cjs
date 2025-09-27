const mongoose = require('mongoose');

async function checkDeviceSecrets() {
  try {
    await mongoose.connect('mongodb://localhost:27017/aims_smart_class');

    const Device = mongoose.model('Device', new mongoose.Schema({
      name: String,
      deviceSecret: String,
      macAddress: String,
      ipAddress: String
    }));

    const devices = await Device.find({}, 'name deviceSecret macAddress ipAddress').lean();

    console.log('All devices in database:');
    devices.forEach((d, index) => {
      console.log(`${index + 1}. ${d.name} (MAC: ${d.macAddress}, IP: ${d.ipAddress})`);
      console.log(`   Secret: ${d.deviceSecret || 'NO SECRET'}`);
    });

    // Check for duplicates among devices that have secrets
    const devicesWithSecrets = devices.filter(d => d.deviceSecret);
    const secrets = devicesWithSecrets.map(d => d.deviceSecret);
    const uniqueSecrets = new Set(secrets);
    console.log(`\nTotal devices: ${devices.length}`);
    console.log(`Devices with secrets: ${devicesWithSecrets.length}`);
    console.log(`Unique secrets: ${uniqueSecrets.size}`);

    if (secrets.length !== uniqueSecrets.size) {
      console.log('WARNING: Duplicate secrets found!');
      // Show duplicates
      const secretCounts = {};
      secrets.forEach(s => secretCounts[s] = (secretCounts[s] || 0) + 1);
      Object.entries(secretCounts).forEach(([secret, count]) => {
        if (count > 1) {
          console.log(`Secret "${secret}" appears ${count} times`);
        }
      });
    } else if (devicesWithSecrets.length > 0) {
      console.log('All secrets are unique.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkDeviceSecrets();