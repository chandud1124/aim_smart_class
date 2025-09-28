import axios from 'axios';

async function testStudentRegistration() {
  console.log('Testing student registration with class field...');
  try {
    const response = await axios.post('http://localhost:3001/api/auth/register', {
      name: 'Test Student',
      email: 'teststudent@example.com',
      password: 'password123',
      role: 'student',
      class: 'BSCS-2024',
      phone: '1234567890',
      reason: 'Testing student registration with class field'
    });

    console.log('✅ SUCCESS: Student registration successful');
    console.log('User data:', JSON.stringify(response.data.user, null, 2));
    return true;
  } catch (error) {
    console.error('❌ FAILED: Student registration failed');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

testStudentRegistration();