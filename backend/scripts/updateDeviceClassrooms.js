const mongoose = require('mongoose');
const Device = require('../models/Device');

async function createDepartmentDevices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autovolt');
        console.log('Connected to MongoDB');

        // Update existing devices to have Computer Science department classrooms
        const updates = [
            {
                macAddress: '80:F3:DA:64:C6:28',
                classroom: 'Computer Science-101'
            },
            {
                macAddress: 'F0:24:F9:0C:5F:8C', 
                classroom: 'Computer Science-201'
            },
            {
                macAddress: '80:F3:DA:65:47:38',
                classroom: 'Computer Science-301'
            }
        ];

        for (const update of updates) {
            await Device.findOneAndUpdate(
                { macAddress: update.macAddress },
                { classroom: update.classroom },
                { new: true }
            );
            console.log(`✅ Updated device ${update.macAddress} classroom to ${update.classroom}`);
        }

        // List all devices with their classrooms
        const allDevices = await Device.find({});
        console.log(`\n📱 All devices and their classrooms:`);
        allDevices.forEach(device => {
            console.log(`- ${device.name}: ${device.classroom || 'No classroom'}`);
        });

        console.log('\n🎉 Device classrooms updated for Computer Science department');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error updating devices:', error);
        process.exit(1);
    }
}

createDepartmentDevices();
