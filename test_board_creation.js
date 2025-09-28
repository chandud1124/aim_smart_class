import axios from 'axios';

async function testBoardCreation() {
  try {
    // Use the existing JWT token from test files
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OTgwMDNlZjA5MjIzNmU4NjBlYzVmYSIsImlhdCI6MTc1ODIxNjY4OSwiZXhwIjoxNzU4ODIxNDg5fQ.8ZEj0CttXByZDfI6z3e-N6Dkfio-0ty16S6T5S0KCtg';

    console.log('Using token:', token.substring(0, 20) + '...');

    // Now test board creation
    const boardData = {
      name: 'Test Raspberry Pi Board',
      ipAddress: '192.168.1.100',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      location: 'Test Lab'
      // Note: groupId is omitted to test the fix
    };

    console.log('Sending board data:', JSON.stringify(boardData, null, 2));

    const response = await axios.post('http://localhost:3001/api/boards', boardData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Board creation successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      if (error.response.data?.errors) {
        console.error('Validation Errors:');
        error.response.data.errors.forEach(err => {
          console.error(`  - ${err.msg} (field: ${err.param})`);
        });
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
  }
}

testBoardCreation();