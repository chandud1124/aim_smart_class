const axios = require('axios');

// Test script to debug real-time user role updates
async function testRealtimeRoleUpdate() {
  try {
    console.log('🧪 Testing Real-Time Role Update System...\n');

    // Test 1: Check if server is running and Socket.IO is available
    console.log('1. Testing server connectivity...');
    try {
      const healthResponse = await axios.get('http://localhost:3001/health');
      console.log('✅ Server is running');
    } catch (error) {
      console.log('❌ Server not accessible:', error.message);
      return;
    }

    // Get admin token by logging in
    console.log('\n3. Logging in as admin...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@iotclassroom.com',
      password: 'admin123456'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Admin login failed');
      return;
    }

    const adminToken = loginResponse.data.token;
    console.log('✅ Admin login successful, got token');

    // Get list of users
    const usersResponse = await axios.get('http://localhost:3001/api/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users = usersResponse.data.data;
    console.log(`✅ Found ${users.length} users`);

    // Find a test user (not admin)
    const testUser = users.find(u => u.role !== 'admin' && u.role !== 'super-admin');
    if (!testUser) {
      console.log('❌ No suitable test user found (need non-admin user)');
      return;
    }

    console.log(`📋 Test user: ${testUser.name} (${testUser.email}) - Current role: ${testUser.role}`);

    // Test 3: Update user role
    const newRole = testUser.role === 'student' ? 'teacher' : 'student';
    console.log(`\n3. Updating role from '${testUser.role}' to '${newRole}'...`);

    const updateResponse = await axios.put(`http://localhost:3001/api/users/${testUser.id}`, {
      role: newRole
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('✅ Role update API call successful');
    console.log('📊 Response:', JSON.stringify(updateResponse.data, null, 2));

    // Test 4: Verify the change was persisted
    console.log('\n4. Verifying role change was saved...');
    const verifyResponse = await axios.get(`http://localhost:3001/api/users/${testUser.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const updatedUser = verifyResponse.data;
    if (updatedUser.role === newRole) {
      console.log('✅ Role change verified in database');
    } else {
      console.log('❌ Role change not saved properly');
      console.log(`   Expected: ${newRole}, Got: ${updatedUser.role}`);
    }

    console.log('\n🎯 Real-Time Update Test:');
    console.log('   1. Login as the test user in another browser/tab');
    console.log('   2. Check browser console for WebSocket events');
    console.log('   3. Verify toast notification appears');
    console.log('   4. Check if user permissions update immediately');
    console.log(`   5. Test user: ${testUser.email} (role changed to: ${newRole})`);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testRealtimeRoleUpdate();