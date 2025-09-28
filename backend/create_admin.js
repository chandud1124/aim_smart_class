const mongoose = require('mongoose');
const User = require('./models/User');

async function createAdminIfNotExists() {
  try {
    await mongoose.connect('mongodb://localhost:27017/iot_classroom');

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    const adminUser = new User({
      name: 'System Administrator',
      email: 'admin@company.com',
      password: 'admin123456', // This will be hashed by the pre-save hook
      role: 'admin',
      department: 'IT Department',
      accessLevel: 'full'
    });

    await adminUser.save();
    console.log('Admin user created successfully');
    console.log('Email: admin@company.com');
    console.log('Password: admin123456');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createAdminIfNotExists();