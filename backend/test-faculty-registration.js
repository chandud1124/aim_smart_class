const axios = require('axios');

async function testFacultyRegistration() {
  try {
    console.log('Testing faculty registration...');

    const facultyData = {
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@university.edu',
      password: 'faculty123',
      role: 'faculty',
      department: 'Computer Science',
      employeeId: 'FAC001'
    };

    const response = await axios.post('http://localhost:3002/api/auth/register', facultyData);

    console.log('✅ Faculty registration successful!');
    console.log('User:', {
      id: response.data.user.id,
      name: response.data.user.name,
      email: response.data.user.email,
      role: response.data.user.role,
      department: response.data.user.department
    });

    // Check if notifications were created
    const notificationsResponse = await axios.get('http://localhost:3002/api/notifications', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });

    console.log('Notifications created:', notificationsResponse.data.length);
    if (notificationsResponse.data.length > 0) {
      console.log('Latest notification:', {
        type: notificationsResponse.data[0].type,
        title: notificationsResponse.data[0].title,
        message: notificationsResponse.data[0].message.substring(0, 100) + '...'
      });
    }

    return response.data;
  } catch (error) {
    console.error('❌ Faculty registration failed:', error.response?.data || error.message);
    throw error;
  }
}

testFacultyRegistration();