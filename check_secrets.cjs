const mongoose = require('mongoose');

async function checkDeviceSecrets() {
  try {
    await mongoose.connect('mongodb://localhost:27017/aims_smart_class', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const Device = mongoose.model('Device', new mongoose.Schema({
      name: String,
      deviceSecret: String
    }));

    const devices = await Device.find({}, 'name deviceSecret').lean();

    console.log('Device secrets in database:');
    devices.forEach((d, index) => {
      console.log(`${index + 1}. ${d.name}: ${d.deviceSecret}`);
    });

    // Check for duplicates
    const secrets = devices.map(d => d.deviceSecret);
    const uniqueSecrets = new Set(secrets);
    console.log(`\nTotal devices: ${devices.length}`);
    console.log(`Unique secrets: ${uniqueSecrets.size}`);

    if (secrets.length !== uniqueSecrets.size) {
      console.log('WARNING: Duplicate secrets found!');
    } else {
      console.log('All secrets are unique.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkDeviceSecrets();