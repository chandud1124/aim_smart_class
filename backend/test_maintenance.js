const metricsService = require('./metricsService');

async function testMaintenance() {
  try {
    console.log('Testing getPredictiveMaintenance function...');
    const result = await metricsService.getPredictiveMaintenance();
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMaintenance();