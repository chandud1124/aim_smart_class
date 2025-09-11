const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const testApiLogin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autovolt');
        console.log('✅ Connected to MongoDB');

        const testEmail = 'apitestuser@college.edu';
        const testPassword = 'apitest123';
        
        // Clean up any existing test user
        await User.deleteOne({ email: testEmail });

        console.log('\n🔍 STEP 1: Creating test user...');
        
        // Create a new user
        const newUser = new User({
            name: 'API Test User',
            email: testEmail,
            password: testPassword,
            role: 'faculty',
            department: 'Testing',
            employeeId: 'APITEST001',
            isActive: false,  // Initially inactive
            isApproved: false // Initially not approved
        });

        await newUser.save();
        console.log('✅ Test user created (inactive/unapproved)');

        console.log('\n🔍 STEP 2: Testing API login before approval...');
        try {
            const response = await axios.post('http://172.16.3.171:3001/api/auth/login', {
                email: testEmail,
                password: testPassword
            });
            console.log('❌ Unexpected: Login succeeded before approval');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Expected: Login failed with 401 (pending approval)');
                console.log(`   Message: ${error.response.data.message}`);
            } else {
                console.log(`❌ Unexpected error: ${error.message}`);
            }
        }

        console.log('\n🔍 STEP 3: Approving user...');
        
        const userToApprove = await User.findOne({ email: testEmail });
        userToApprove.isActive = true;
        userToApprove.isApproved = true;
        userToApprove.canRequestExtensions = true;
        await userToApprove.save();
        
        console.log('✅ User approved and activated');

        console.log('\n🔍 STEP 4: Testing API login after approval...');
        try {
            const response = await axios.post('http://172.16.3.171:3001/api/auth/login', {
                email: testEmail,
                password: testPassword
            });
            
            if (response.data.success && response.data.token) {
                console.log('✅ SUCCESS: Login succeeded after approval!');
                console.log(`   User: ${response.data.user.name} (${response.data.user.role})`);
                console.log(`   Token received: ${response.data.token.substring(0, 50)}...`);
                
                // Test authenticated request
                console.log('\n🔍 STEP 5: Testing authenticated API call...');
                try {
                    const profileResponse = await axios.get('http://172.16.3.171:3001/api/auth/profile', {
                        headers: {
                            Authorization: `Bearer ${response.data.token}`
                        }
                    });
                    console.log('✅ Authenticated API call successful!');
                    console.log(`   Profile: ${profileResponse.data.user.name}`);
                } catch (authError) {
                    console.log(`❌ Authenticated API call failed: ${authError.message}`);
                }
            } else {
                console.log('❌ Login response missing token or success flag');
            }
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ Login failed: ${error.response.status} - ${error.response.data.message}`);
            } else {
                console.log(`❌ Login error: ${error.message}`);
            }
        }

        // Clean up
        await User.deleteOne({ email: testEmail });
        console.log('\n🧹 Test user cleaned up');

    } catch (error) {
        console.error('❌ Test error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
};

testApiLogin();
