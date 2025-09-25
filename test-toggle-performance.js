import axios from 'axios';

// Simple script to test toggleSwitch performance timing
async function testTogglePerformance() {
  try {
    // First, login to get a token (assuming test user exists)
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@example.com',
      password: 'password123'
    });

    const token = loginResponse.data.token;
    console.log('Logged in successfully');

    // Get a device to toggle
    const devicesResponse = await axios.get('http://localhost:3001/api/devices', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (devicesResponse.data.data.length === 0) {
      console.log('No devices found for testing');
      return;
    }

    const device = devicesResponse.data.data[0];
    const switchId = device.switches[0]._id;

    console.log(`Testing toggle for device: ${device.name}, switch: ${device.switches[0].name}`);

    // Perform toggle and measure timing
    const startTime = Date.now();
    const toggleResponse = await axios.post(
      `http://localhost:3001/api/devices/${device._id}/switches/${switchId}/toggle`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const endTime = Date.now();
    console.log(`Toggle completed in ${endTime - startTime}ms`);
    console.log('Check server logs for detailed timing breakdown');

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testTogglePerformance();