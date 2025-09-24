// test-analytics.js
// Simple test script to verify analytics endpoints work

const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

async function testAnalyticsEndpoints() {
  console.log('Testing Analytics Endpoints...\n');

  try {
    // Test dashboard endpoint
    console.log('1. Testing /api/analytics/dashboard...');
    const dashboardRes = await axios.get(`${BASE_URL}/api/analytics/dashboard`);
    console.log('✅ Dashboard endpoint works');
    console.log('   Response keys:', Object.keys(dashboardRes.data));
    console.log('   Devices count:', dashboardRes.data.devices?.length || 0);
    console.log('   Summary:', dashboardRes.data.summary);

  } catch (error) {
    console.error('❌ Error testing analytics endpoints:');
    console.error('   Message:', error.message);
    if (error.code) console.error('   Code:', error.code);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Status Text:', error.response.statusText);
      console.error('   Response Data:', error.response.data);
    } else if (error.request) {
      console.error('   No response received. Request details:', error.request);
    }
  }
}

testAnalyticsEndpoints();