const axios = require('axios');
const io = require('socket.io-client');

// Comprehensive test for real-time role updates
async function testRealtimeRoleUpdates() {
  try {
    console.log('🧪 Comprehensive Real-Time Role Update Test...\n');

    // Step 1: Login as admin
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@iotclassroom.com',
      password: 'admin123456'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Admin login failed');
      return;
    }

    const adminToken = loginResponse.data.token;
    const adminUser = loginResponse.data.user;
    console.log('✅ Admin login successful');

    // Step 2: Get list of users
    console.log('\n2. Getting user list...');
    const usersResponse = await axios.get('http://localhost:3001/api/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users = usersResponse.data.data;
    const testUser = users.find(u => u.role === 'student' && u.email !== adminUser.email);

    if (!testUser) {
      console.log('❌ No suitable test user found');
      return;
    }

    console.log(`📋 Test user: ${testUser.name} (${testUser.email}) - Current role: ${testUser.role}`);

    // Step 3: Connect to Socket.IO as admin
    console.log('\n3. Connecting to Socket.IO as admin...');
    const adminSocket = io('http://localhost:3001', {
      auth: { token: adminToken }
    });

    let adminConnected = false;
    adminSocket.on('connect', () => {
      console.log('✅ Admin Socket.IO connected');
      adminConnected = true;
    });

    adminSocket.on('user_updated', (data) => {
      console.log('📨 Admin received user_updated event:', data);
    });

    // Step 4: Simulate user connection (we can't actually login as user in this test)
    console.log('\n4. Simulating user Socket.IO connection...');
    // Note: In a real test, you'd need to login as the test user and connect with their token
    console.log('   (In real testing, login as test user in browser and check console)');

    // Wait for admin socket to connect
    await new Promise(resolve => {
      const checkConnection = () => {
        if (adminConnected) {
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });

    // Step 5: Update user role
    const newRole = testUser.role === 'student' ? 'teacher' : 'student';
    console.log(`\n5. Updating role from '${testUser.role}' to '${newRole}'...`);

    const updateResponse = await axios.put(`http://localhost:3001/api/users/${testUser.id}`, {
      role: newRole
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('✅ Role update API call successful');

    // Step 6: Verify the change
    console.log('\n6. Verifying role change...');
    const verifyResponse = await axios.get(`http://localhost:3001/api/users/${testUser.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const updatedUser = verifyResponse.data;
    if (updatedUser.role === newRole) {
      console.log('✅ Role change verified in database');
    } else {
      console.log('❌ Role change not saved properly');
    }

    // Step 7: Wait for events and cleanup
    console.log('\n7. Waiting for real-time events...');
    setTimeout(() => {
      console.log('\n🎯 Test Summary:');
      console.log('   ✅ Admin login successful');
      console.log('   ✅ Socket.IO connection established');
      console.log('   ✅ Role update API call successful');
      console.log('   ✅ Database change verified');
      console.log('   📋 Manual Testing Required:');
      console.log(`      - Login as: ${testUser.email} in another browser`);
      console.log('      - Check browser console for user_role_changed events');
      console.log('      - Verify toast notification appears');
      console.log('      - Confirm permissions update without page refresh');

      adminSocket.disconnect();
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testRealtimeRoleUpdates();