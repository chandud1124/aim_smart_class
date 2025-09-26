const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');
    const User = require('./models/User');
    const users = await User.find({}).select('name email role isApproved isActive');
    console.log('Users in database:');
    users.forEach(u => console.log(`- ${u.name} (${u.email}) - ${u.role} - Approved: ${u.isApproved} - Active: ${u.isActive}`));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();