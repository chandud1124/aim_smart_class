const axios = require('axios');

// Simple test for student registration
const API_BASE_URL = 'http://localhost:3002/api';

async function testStudentRegistration() {
  console.log('🧪 Testing Student Registration');
  console.log('================================');

  const studentData = {
    name: 'Test Student',
    email: 'test.student@example.com',
    password: 'TestPass123!',
    role: 'student',
    department: 'Computer Science',
    phone: '+1234567890'
  };

  try {
    console.log('📤 Sending registration request...');
    const response = await axios.post(`${API_BASE_URL}/auth/register`, studentData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Registration successful!');
    console.log('📊 Response:', {
      success: response.data.success,
      message: response.data.message,
      user: {
        id: response.data.user.id,
        name: response.data.user.name,
        email: response.data.user.email,
        role: response.data.user.role,
        department: response.data.user.department,
        isActive: response.data.user.isActive,
        isApproved: response.data.user.isApproved
      }
    });

    return { success: true, data: response.data };

  } catch (error) {
    console.log('❌ Registration failed!');

    if (error.response) {
      console.log('📊 Error Response:', {
        status: error.response.status,
        message: error.response.data.message || error.response.data,
        error: error.response.data.error
      });
    } else if (error.request) {
      console.log('📊 Network Error: No response received from server');
      console.log('🔍 Check if backend server is running on port 3002');
    } else {
      console.log('📊 Request Error:', error.message);
    }

    return { success: false, error: error.message };
  }
}

// Run the test
testStudentRegistration()
  .then((result) => {
    if (result.success) {
      console.log('\n🎉 Student registration test passed!');
      console.log('📋 Check backend logs for admin notification creation');
    } else {
      console.log('\n❌ Student registration test failed');
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });