// Usage: node fixAllUsersActiveApproved.js

const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aims_smart_class';

async function fixAllUsers() {
  await mongoose.connect(MONGO_URI);
  const result = await User.updateMany({}, { $set: { isActive: true, isApproved: true } });
  console.log('All users updated:', result.modifiedCount);
  mongoose.disconnect();
}

fixAllUsers();
