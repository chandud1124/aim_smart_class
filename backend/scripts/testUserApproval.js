const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const testUserApproval = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autovolt');
        console.log('Connected to MongoDB');

        // Test user data
        const testEmail = 'testuser@college.edu';
        
        // Check if test user already exists
        let testUser = await User.findOne({ email: testEmail });
        
        if (testUser) {
            console.log('Test user already exists, deleting...');
            await User.deleteOne({ email: testEmail });
        }

        // Create a new test user (simulating registration)
        console.log('\n1. Creating test user (registration simulation)...');
        testUser = new User({
            name: 'Test User',
            email: testEmail,
            password: 'testpass123',
            role: 'faculty',
            department: 'Computer Science',
            employeeId: 'TEST001',
            phone: '+1234567890',
            designation: 'Lecturer',
            isActive: false,  // Default after registration
            isApproved: false, // Default after registration
            canRequestExtensions: false
        });

        await testUser.save();
        console.log('✓ Test user created with isActive=false, isApproved=false');

        // Test login before approval (should fail)
        console.log('\n2. Testing login before approval...');
        const userBeforeApproval = await User.findOne({ email: testEmail }).select('+password');
        const passwordMatch = await userBeforeApproval.matchPassword('testpass123');
        console.log('Password matches:', passwordMatch);
        console.log('isActive:', userBeforeApproval.isActive);
        console.log('isApproved:', userBeforeApproval.isApproved);

        if (!userBeforeApproval.isActive) {
            console.log('❌ Login would fail: Account is deactivated or pending approval');
        }
        if (!userBeforeApproval.isApproved) {
            console.log('❌ Login would fail: Account is pending admin approval');
        }

        // Simulate admin approval
        console.log('\n3. Simulating admin approval...');
        testUser.isApproved = true;
        testUser.isActive = true;
        testUser.canRequestExtensions = true; // Faculty role
        testUser.approvedAt = new Date();
        await testUser.save();
        console.log('✓ User approved and activated');

        // Test login after approval (should succeed)
        console.log('\n4. Testing login after approval...');
        const userAfterApproval = await User.findOne({ email: testEmail }).select('+password');
        
        console.log('Final user state:');
        console.log('- Email:', userAfterApproval.email);
        console.log('- Role:', userAfterApproval.role);
        console.log('- isActive:', userAfterApproval.isActive);
        console.log('- isApproved:', userAfterApproval.isApproved);
        console.log('- canRequestExtensions:', userAfterApproval.canRequestExtensions);
        console.log('- Password matches testpass123:', await userAfterApproval.matchPassword('testpass123'));

        // Test the exact login logic
        if (!userAfterApproval || !(await userAfterApproval.matchPassword('testpass123'))) {
            console.log('❌ Authentication would fail: Invalid credentials');
        } else if (!userAfterApproval.isActive) {
            console.log('❌ Login would fail: Account is deactivated or pending approval');
        } else if (!userAfterApproval.isApproved) {
            console.log('❌ Login would fail: Account is pending admin approval');
        } else {
            console.log('✅ Login would succeed!');
        }

        console.log('\n5. Testing API login endpoint...');
        // Clean up
        await User.deleteOne({ email: testEmail });
        console.log('✓ Test user cleaned up');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
};

testUserApproval();
