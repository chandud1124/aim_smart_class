const axios = require('axios');

// Test script for user registration with different roles
const API_BASE_URL = 'http://localhost:3002/api';

// Test data for different roles
const testUsers = [
  {
    name: 'John Student',
    email: 'john.student@test.com',
    password: 'TestPass123!',
    role: 'student',
    department: 'Computer Science',
    phone: '+1234567890'
  },
  {
    name: 'Dr. Sarah Faculty',
    email: 'sarah.faculty@test.com',
    password: 'TestPass123!',
    role: 'faculty',
    department: 'Computer Science',
    employeeId: 'FAC001',
    designation: 'Associate Professor',
    phone: '+1234567891'
  },
  {
    name: 'Mike Teacher',
    email: 'mike.teacher@test.com',
    password: 'TestPass123!',
    role: 'teacher',
    department: 'Mathematics',
    employeeId: 'TEA001',
    designation: 'Mathematics Teacher',
    phone: '+1234567892'
  },
  {
    name: 'Admin User',
    email: 'admin.user@test.com',
    password: 'TestPass123!',
    role: 'admin',
    department: 'IT Administration',
    employeeId: 'ADM001',
    designation: 'System Administrator',
    phone: '+1234567893'
  },
  {
    name: 'Security Guard',
    email: 'security.guard@test.com',
    password: 'TestPass123!',
    role: 'security',
    department: 'Security',
    employeeId: 'SEC001',
    designation: 'Security Officer',
    phone: '+1234567894'
  },
  {
    name: 'Guest Visitor',
    email: 'guest.visitor@test.com',
    password: 'TestPass123!',
    role: 'guest',
    department: 'Visitor',
    phone: '+1234567895',
    reason: 'Lab demonstration visit'
  }
];

// Function to test registration for a specific user
async function testRegistration(userData, index) {
  console.log(`\n🧪 Testing registration for ${userData.role.toUpperCase()}: ${userData.name}`);
  console.log('='.repeat(60));

  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, userData, {
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
      // Server responded with error status
      console.log('📊 Error Response:', {
        status: error.response.status,
        message: error.response.data.message || error.response.data,
        error: error.response.data.error
      });
    } else if (error.request) {
      // Request was made but no response received
      console.log('📊 Network Error: No response received from server');
      console.log('🔍 Check if backend server is running on port 3002');
    } else {
      // Something else happened
      console.log('📊 Request Error:', error.message);
    }

    return { success: false, error: error.message };
  }
}

// Function to test duplicate email registration
async function testDuplicateRegistration(userData) {
  console.log(`\n🔄 Testing duplicate registration for: ${userData.email}`);
  console.log('-'.repeat(40));

  try {
    await axios.post(`${API_BASE_URL}/auth/register`, userData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log('❌ Duplicate registration should have failed!');
    return { success: false, message: 'Duplicate registration was allowed' };

  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Duplicate registration correctly blocked!');
      console.log('📊 Error Message:', error.response.data.message);
      return { success: true, message: 'Duplicate correctly prevented' };
    } else {
      console.log('❌ Unexpected error during duplicate test:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Function to check server health
async function checkServerHealth() {
  console.log('🏥 Checking server health...');

  try {
    const response = await axios.get(`${API_BASE_URL}/health`, {
      timeout: 5000
    });

    console.log('✅ Server is healthy!');
    return true;

  } catch (error) {
    console.log('❌ Server health check failed!');
    console.log('🔍 Make sure the backend server is running on port 3002');
    console.log('💡 Run: cd backend && PORT=3002 node server.js');
    return false;
  }
}

// Main test function
async function runRegistrationTests() {
  console.log('🚀 Starting User Registration Tests');
  console.log('=====================================');
  console.log(`📅 Test Date: ${new Date().toISOString()}`);
  console.log(`🌐 API Endpoint: ${API_BASE_URL}`);
  console.log('');

  // Check server health first
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    console.log('\n❌ Tests aborted due to server health issues');
    process.exit(1);
  }

  const results = {
    total: testUsers.length,
    successful: 0,
    failed: 0,
    details: []
  };

  // Test registration for each role
  for (let i = 0; i < testUsers.length; i++) {
    const userData = testUsers[i];
    const result = await testRegistration(userData, i);

    results.details.push({
      role: userData.role,
      name: userData.name,
      success: result.success,
      error: result.error || null
    });

    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
    }

    // Add small delay between requests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Test duplicate registration prevention
  console.log('\n🔒 Testing Duplicate Registration Prevention');
  console.log('===========================================');

  const duplicateTest = await testDuplicateRegistration(testUsers[0]);
  results.duplicateTest = duplicateTest;

  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Duplicate Prevention: ${duplicateTest.success ? '✅ Working' : '❌ Failed'}`);

  if (results.failed === 0 && duplicateTest.success) {
    console.log('\n🎉 All tests passed! User registration system is working correctly.');
    console.log('📋 Next steps:');
    console.log('   1. Check backend logs for admin notification creation');
    console.log('   2. Verify notifications appear in admin dashboard');
    console.log('   3. Test admin approval workflow');
  } else {
    console.log('\n⚠️  Some tests failed. Check the details above for issues.');
  }

  // Detailed results
  console.log('\n📋 Detailed Results:');
  results.details.forEach((detail, index) => {
    const status = detail.success ? '✅' : '❌';
    console.log(`${index + 1}. ${detail.role.toUpperCase()}: ${detail.name} - ${status}`);
    if (!detail.success && detail.error) {
      console.log(`   Error: ${detail.error}`);
    }
  });

  return results;
}

// Run the tests
if (require.main === module) {
  runRegistrationTests()
    .then(() => {
      console.log('\n🏁 Registration tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runRegistrationTests, testRegistration, checkServerHealth };