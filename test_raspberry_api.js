// Test script for Raspberry Pi API endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const DEVICE_ID = 'raspberry_001';

// Test functions
async function testRaspberryAPI() {
  console.log('Testing Raspberry Pi API endpoints...\n');

  try {
    // Test 1: Get device config (will fail if device doesn't exist, but tests the route)
    console.log('1. Testing GET /api/raspberry/config/:deviceId');
    try {
      const configResponse = await axios.get(`${BASE_URL}/raspberry/config/${DEVICE_ID}`);
      console.log('✅ Config endpoint works:', configResponse.data);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️  Config endpoint works but device not found (expected)');
      } else {
        console.log('❌ Config endpoint error:', error.message);
      }
    }

    // Test 2: Send command
    console.log('\n2. Testing POST /api/raspberry/command/:deviceId');
    try {
      const commandResponse = await axios.post(`${BASE_URL}/raspberry/command/${DEVICE_ID}`, {
        command: 'get_status',
        params: { test: true }
      });
      console.log('✅ Command endpoint works:', commandResponse.data);
    } catch (error) {
      console.log('❌ Command endpoint error:', error.message);
    }

    // Test 3: GPIO control
    console.log('\n3. Testing POST /api/raspberry/gpio/:deviceId/:pin/:state');
    try {
      const gpioResponse = await axios.post(`${BASE_URL}/raspberry/gpio/${DEVICE_ID}/17/on`);
      console.log('✅ GPIO endpoint works:', gpioResponse.data);
    } catch (error) {
      console.log('❌ GPIO endpoint error:', error.message);
    }

    console.log('\n🎉 Raspberry Pi API tests completed!');
    console.log('\nNext steps:');
    console.log('1. Set up your Raspberry Pi with the provided client script');
    console.log('2. Register the Raspberry Pi device in your database');
    console.log('3. Test actual GPIO control and sensor monitoring');

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run tests
testRaspberryAPI();