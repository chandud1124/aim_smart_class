const mongoose = require('mongoose');
const Device = require('../models/Device');

const testDevices = [
    {
        name: 'CS Lab 1 - Light 1',
        macAddress: '80:F3:DA:64:C6:28',
        ipAddress: '172.16.3.181',
        location: 'Computer Science Lab 1',
        classroom: 'CS-101',
        switches: [{
            name: 'Main Light',
            gpio: 2,
            type: 'light',
            state: false,
            usePir: true,
            dontAutoOff: false
        }],
        status: 'online',
        lastSeen: new Date(),
        assignedUsers: []
    },
    {
        name: 'CS Lab 1 - Fan 1',
        macAddress: '80:F3:DA:65:47:38',
        ipAddress: '172.16.3.182',
        location: 'Computer Science Lab 1',
        classroom: 'CS-101',
        switches: [{
            name: 'Ceiling Fan',
            gpio: 4,
            type: 'fan',
            state: false,
            usePir: false,
            dontAutoOff: false
        }],
        status: 'online',
        lastSeen: new Date(),
        assignedUsers: []
    }
];

async function createTestDevices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');
        console.log('Connected to MongoDB');

        for (const deviceData of testDevices) {
            // Check if device already exists
            const existingDevice = await Device.findOne({ macAddress: deviceData.macAddress });
            
            if (existingDevice) {
                console.log(`Device ${deviceData.name} already exists`);
            } else {
                const device = new Device(deviceData);
                await device.save();
                console.log(`✅ Created device: ${deviceData.name} - ${deviceData.macAddress}`);
            }
        }

        console.log('\n🎉 Test devices created successfully');
        
        // List all devices
        const allDevices = await Device.find({});
        console.log(`\n📱 Total devices in database: ${allDevices.length}`);
        allDevices.forEach(device => {
            console.log(`- ${device.name} - ${device.classroom} - Switches: ${device.switches.length}`);
        });

        process.exit(0);

    } catch (error) {
        console.error('❌ Error creating devices:', error);
        process.exit(1);
    }
}

createTestDevices();
