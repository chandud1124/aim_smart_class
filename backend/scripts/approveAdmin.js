const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

(async () => {
  try {
    const email = (process.argv[2] || process.env.ADMIN_EMAIL || 'admin@college.edu').toLowerCase();
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom';
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const res = await User.updateOne(
      { email },
      {
        $set: {
          role: 'admin',
          accessLevel: 'full',
          isActive: true,
          isApproved: true,
          canRequestExtensions: true,
          canApproveExtensions: true,
        }
      }
    );
    if (res.matchedCount === 0) {
      console.log('No user found with email:', email);
    } else {
      console.log('Admin approved/activated for:', email);
    }
  } catch (e) {
    console.error('approveAdmin error', e);
  } finally {
    await mongoose.disconnect();
  }
})();
