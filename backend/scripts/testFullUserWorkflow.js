const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const testFullUserWorkflow = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autovolt');
        console.log('✅ Connected to MongoDB');

        const testEmail = 'newuser@test.college.edu';
        
        // Clean up any existing test user
        await User.deleteOne({ email: testEmail });

        console.log('\n🔍 STEP 1: Simulating new user registration...');
        
        // Create a new user as the registration endpoint would
        const newUser = new User({
            name: 'New Test User',
            email: testEmail,
            password: 'newuserpass123',
            role: 'faculty',
            department: 'Computer Science',
            employeeId: 'NEWTEST001',
            phone: '+1234567890',
            designation: 'Assistant Professor',
            isActive: false,  // Default: needs admin approval
            isApproved: false, // Default: needs admin approval
            canRequestExtensions: false
        });

        await newUser.save();
        console.log('✅ New user registered (pending approval)');

        // Test login before approval
        console.log('\n🔍 STEP 2: Testing login before approval...');
        const userBeforeApproval = await User.findOne({ email: testEmail }).select('+password');
        
        if (!userBeforeApproval.isActive) {
            console.log('❌ Expected: Login fails - Account is deactivated or pending approval');
        }
        if (!userBeforeApproval.isApproved) {
            console.log('❌ Expected: Login fails - Account is pending admin approval');
        }

        console.log('\n🔍 STEP 3: Simulating admin approval...');
        
        // Simulate what happens when admin approves the user
        userBeforeApproval.isApproved = true;
        userBeforeApproval.isActive = true;
        userBeforeApproval.approvedAt = new Date();
        
        // Set permissions based on role (faculty gets extension request permission)
        userBeforeApproval.canRequestExtensions = true;
        
        await userBeforeApproval.save();
        console.log('✅ User approved by admin');

        console.log('\n🔍 STEP 4: Testing login after approval...');
        const userAfterApproval = await User.findOne({ email: testEmail }).select('+password');
        
        console.log('Final user state:');
        console.log(`- Email: ${userAfterApproval.email}`);
        console.log(`- Role: ${userAfterApproval.role}`);
        console.log(`- isActive: ${userAfterApproval.isActive}`);
        console.log(`- isApproved: ${userAfterApproval.isApproved}`);
        console.log(`- canRequestExtensions: ${userAfterApproval.canRequestExtensions}`);

        // Test the exact login logic from authController
        const passwordMatches = await userAfterApproval.matchPassword('newuserpass123');
        console.log(`- Password matches: ${passwordMatches}`);

        if (!userAfterApproval || !passwordMatches) {
            console.log('❌ Authentication would fail: Invalid credentials');
        } else if (!userAfterApproval.isActive) {
            console.log('❌ Login would fail: Account is deactivated or pending approval');
        } else if (!userAfterApproval.isApproved) {
            console.log('❌ Login would fail: Account is pending admin approval');
        } else {
            console.log('✅ Login should succeed! All checks passed.');
        }

        // Clean up
        await User.deleteOne({ email: testEmail });
        console.log('\n🧹 Test user cleaned up');

        // Test with existing users
        console.log('\n🔍 STEP 5: Checking existing admin accounts...');
        const admins = await User.find({ role: 'admin' }).select('email role isActive isApproved');
        
        for (const admin of admins) {
            console.log(`Admin: ${admin.email}`);
            console.log(`  - isActive: ${admin.isActive}`);
            console.log(`  - isApproved: ${admin.isApproved}`);
            
            if (admin.isActive && admin.isApproved) {
                console.log(`  ✅ Should be able to login`);
            } else {
                console.log(`  ❌ Login would fail`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
};

testFullUserWorkflow();
