const axios = require('axios');

// Set a shorter timeout for axios
axios.defaults.timeout = 5000;

async function testAllRoles() {
  const testData = [
    {
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@university.edu',
      password: 'faculty123',
      role: 'faculty',
      department: 'Computer Science',
      employeeId: 'FAC001'
    }
  ];

  console.log('🚀 Starting faculty registration testing...\n');

  for (let i = 0; i < testData.length; i++) {
    const user = testData[i];
    try {
      console.log(`📝 Testing ${user.role.toUpperCase()} registration: ${user.name}`);

      const response = await axios.post('http://localhost:3002/api/auth/register', user);

      console.log(`✅ ${user.role.toUpperCase()} registration successful!`);
      console.log(`   User ID: ${response.data.user.id}`);
      console.log(`   Name: ${response.data.user.name}`);
      console.log(`   Email: ${response.data.user.email}`);
      console.log(`   Role: ${response.data.user.role}`);
      console.log(`   Department: ${response.data.user.department}`);
      console.log(`   Status: ${response.data.user.isApproved ? 'Approved' : 'Pending Approval'}`);
      console.log('');

    } catch (error) {
      console.error(`❌ ${user.role.toUpperCase()} registration failed:`, error.response?.data?.message || error.message);
      console.log('');
    }
  }

  console.log('🎉 Faculty registration testing completed!');
}

testAllRoles().catch(console.error);