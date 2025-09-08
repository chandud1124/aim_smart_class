const mongoose = require('mongoose');
const User = require('../models/User');

const users = [
    {
        name: 'Dean Johnson',
        email: 'dean@college.edu',
        password: 'dean123',
        role: 'dean',
        department: 'Computer Science',
        isActive: true,
        isApproved: true,
        designation: 'Dean of Engineering'
    },
    {
        name: 'HOD Smith',
        email: 'hod@college.edu', 
        password: 'hod123',
        role: 'hod',
        department: 'Computer Science',
        isActive: true,
        isApproved: true,
        designation: 'Head of Department'
    },
    {
        name: 'Faculty Brown',
        email: 'faculty@college.edu',
        password: 'faculty123', 
        role: 'faculty',
        department: 'Computer Science',
        isActive: true,
        isApproved: true,
        designation: 'Assistant Professor'
    },
    {
        name: 'Student Davis',
        email: 'student@college.edu',
        password: 'student123',
        role: 'student', 
        department: 'Computer Science',
        isActive: true,
        isApproved: true,
        employeeId: 'STD001'
    }
];

async function createTestUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');
        console.log('Connected to MongoDB');

        for (const userData of users) {
            // Check if user already exists
            const existingUser = await User.findOne({ email: userData.email });
            
            if (existingUser) {
                console.log(`User ${userData.email} already exists, updating...`);
                await User.findOneAndUpdate(
                    { email: userData.email },
                    userData,
                    { new: true }
                );
                console.log(`✅ Updated user: ${userData.email} (${userData.role})`);
            } else {
                const user = new User(userData);
                await user.save();
                console.log(`✅ Created user: ${userData.email} (${userData.role})`);
            }
        }

        console.log('\n🎉 Test users created/updated successfully');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error creating users:', error);
        process.exit(1);
    }
}

createTestUsers();
