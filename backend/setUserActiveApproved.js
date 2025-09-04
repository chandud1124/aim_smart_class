// Usage: node setUserActiveApproved.js <user_email>

const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aims_smart_class';

async function setActiveApproved(email) {
  await mongoose.connect(MONGO_URI);
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.log('User not found:', email);
    process.exit(1);
  }
  user.isActive = true;
  user.isApproved = true;
  await user.save();
  console.log('User updated:', user.email, 'isActive:', user.isActive, 'isApproved:', user.isApproved);
  mongoose.disconnect();
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: node setUserActiveApproved.js <user_email>');
  process.exit(1);
}
setActiveApproved(email);
