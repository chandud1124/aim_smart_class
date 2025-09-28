const axios = require('axios');

async function testBoardAPI() {
  const baseURL = 'http://localhost:3001/api';

  try {
    console.log('Testing Board Groups API...');

    // Test board groups endpoint
    const groupsResponse = await axios.get(`${baseURL}/boards/groups`);
    console.log('✓ Board groups endpoint status:', groupsResponse.status);
    console.log('✓ Groups data:', groupsResponse.data);

    // Test boards endpoint
    console.log('\nTesting Boards API...');
    const boardsResponse = await axios.get(`${baseURL}/boards`);
    console.log('✓ Boards endpoint status:', boardsResponse.status);
    console.log('✓ Boards count:', boardsResponse.data.length);

    // Test creating a board with new resolution format
    console.log('\nTesting Board Creation...');
    const newBoard = {
      name: 'Test Board API',
      description: 'Testing API with new resolution format',
      location: 'API Test Location',
      type: 'digital',
      displaySettings: {
        resolution: '1920x1080',
        orientation: 'landscape',
        brightness: 75
      },
      schedule: {
        operatingHours: {
          start: '09:00',
          end: '17:00'
        }
      }
    };

    const createResponse = await axios.post(`${baseURL}/boards`, newBoard);
    console.log('✓ Board creation status:', createResponse.status);
    console.log('✓ Created board:', createResponse.data.name);

    console.log('\n🎉 All API tests passed!');

  } catch (error) {
    console.error('❌ API test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.code) {
      console.error('Network error:', error.code);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testBoardAPI();