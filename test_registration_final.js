import axios from 'axios';

async function testRegistration() {
  try {
    // Test student registration with class field
    const studentData = {
      name: 'Test Student',
      email: 'test.student@example.com',
      password: 'password123',
      role: 'student',
      class: '10th Grade A'
    };

    console.log('Testing student registration...');
    console.log('Sending data:', studentData);
    const studentResponse = await axios.post('http://localhost:3001/api/auth/register', studentData);
    console.log('Student registration success:', studentResponse.data);

    // Test faculty registration with department field
    const facultyData = {
      name: 'Test Faculty',
      email: 'test.faculty@example.com',
      password: 'password123',
      role: 'faculty',
      department: 'Computer Science'
    };

    console.log('Testing faculty registration...');
    console.log('Sending data:', facultyData);
    const facultyResponse = await axios.post('http://localhost:3001/api/auth/register', facultyData);
    console.log('Faculty registration success:', facultyResponse.data);

  } catch (error) {
    console.error('Registration test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testRegistration();