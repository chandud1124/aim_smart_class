import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/aims_smart_class')
  .then(async () => {
    const Device = (await import('./backend/models/Device.js')).default;
    const devices = await Device.find({deviceType: 'esp32'}).select('macAddress deviceType deviceSecret');
    console.log('ESP32 devices:');
    devices.forEach(d => {
      console.log(`MAC: "${d.macAddress}", Type: ${d.deviceType}, Secret length: ${d.deviceSecret ? d.deviceSecret.length : 'none'}`);
    });
    await mongoose.disconnect();
  })
  .catch(console.error);