const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createCollegeAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');

        console.log('Connected to MongoDB');

        // Check if admin already exists with this email
        const existingAdmin = await User.findOne({ email: 'admin@college.edu' });
        if (existingAdmin) {
            console.log('Admin user admin@college.edu already exists');
            // Reset the password
            existingAdmin.password = 'admin123'; // This will be hashed by pre-save middleware
            existingAdmin.isActive = true;
            existingAdmin.isApproved = true;
            await existingAdmin.save();
            console.log('Password reset for admin@college.edu');
            console.log('New password: admin123');
        } else {
            // Create new admin user
            const adminUser = new User({
                name: 'College Administrator',
                email: 'admin@college.edu',
                password: 'admin123', // This will be hashed by the pre-save middleware
                role: 'admin',
                department: 'Administration',
                employeeId: 'ADMIN002',
                phone: '+1234567890',
                designation: 'College Administrator',
                isActive: true,
                isApproved: true,
                accessLevel: 'full',
                canRequestExtensions: true,
                canApproveExtensions: true,
                canManageUsers: true,
                canViewReports: true,
                canControlDevices: true,
                canAccessSecurity: true,
                notificationPreferences: {
                    email: true,
                    inApp: true,
                    securityAlerts: true
                }
            });

            await adminUser.save();

            console.log('College admin user created successfully!');
            console.log('Email: admin@college.edu');
            console.log('Password: admin123');
        }

    } catch (error) {
        console.error('Error creating college admin:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

// Run the script
createCollegeAdmin();
