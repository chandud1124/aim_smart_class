const axios = require('axios');

async function testBulkToggle() {
  try {
    console.log('Testing improved bulk toggle functionality...\n');

    // First, get authentication token (you'll need to replace with actual login)
    console.log('1. Please login first and get your auth token...');
    console.log('   Then update the token in this script and run again.\n');

    // Test bulk toggle OFF
    const token = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token

    if (token === 'YOUR_AUTH_TOKEN_HERE') {
      console.log('Please update the token first!');
      return;
    }

    console.log('2. Testing bulk toggle OFF...');
    const response = await axios.post('http://localhost:3001/api/devices/bulk-toggle', {
      state: false
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.offlineDevices > 0) {
      console.log(`\n✅ Success! ${response.data.commandedDevices} devices commanded, ${response.data.offlineDevices} devices offline (queued)`);
    } else {
      console.log(`\n✅ Success! All ${response.data.commandedDevices} devices commanded`);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testBulkToggle();