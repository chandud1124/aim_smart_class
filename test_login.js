import axios from 'axios';

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@college.edu',
      password: 'admin123456'
    });
    console.log('Login successful:', response.data);
  } catch (error) {
    console.log('Login failed:', error.response ? error.response.data : error.message);
  }
}

testLogin();