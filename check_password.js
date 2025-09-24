import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student' },
  isActive: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function checkPassword() {
  try {
    await mongoose.connect('mongodb://localhost:27017/autovolt');
    const user = await User.findOne({ email: 'admin@college.edu' }).select('+password');
    if (!user) {
      console.log('User not found');
      return;
    }
    console.log('User found:', { email: user.email, isActive: user.isActive, isApproved: user.isApproved });
    const isMatch = await bcrypt.compare('admin123456', user.password);
    console.log('Password match:', isMatch);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkPassword();