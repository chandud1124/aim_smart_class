import axios from 'axios';

async function testStudentRegistration() {
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

    console.log('Registration successful:', response.data);
  } catch (error) {
    console.error('Registration failed:', error.response?.status, error.response?.data || error.message);
  }
}

async function testFacultyRegistration() {
  try {
    const response = await axios.post('http://localhost:3001/api/auth/register', {
      name: 'Test Faculty',
      email: 'testfaculty@example.com',
      password: 'password123',
      role: 'faculty',
      department: 'Computer Science',
      employeeId: 'EMP001',
      phone: '1234567890',
      designation: 'Assistant Professor',
      reason: 'Testing faculty registration with department field'
    });

    console.log('Registration successful:', response.data);
  } catch (error) {
    console.error('Registration failed:', error.response?.status, error.response?.data || error.message);
  }
}

async function testInvalidStudentRegistration() {
  try {
    const response = await axios.post('http://localhost:3001/api/auth/register', {
      name: 'Test Student Invalid',
      email: 'teststudentinvalid@example.com',
      password: 'password123',
      role: 'student',
      department: 'Computer Science', // Should fail - students need class, not department
      phone: '1234567890',
      reason: 'Testing invalid student registration'
    });

    console.log('Registration successful:', response.data);
  } catch (error) {
    console.error('Registration failed (expected):', error.response?.status, error.response?.data || error.message);
  }
}

async function testInvalidFacultyRegistration() {
  try {
    const response = await axios.post('http://localhost:3001/api/auth/register', {
      name: 'Test Faculty Invalid',
      email: 'testfacultyinvalid@example.com',
      password: 'password123',
      role: 'faculty',
      class: 'BSCS-2024', // Should fail - faculty need department, not class
      employeeId: 'EMP002',
      phone: '1234567890',
      designation: 'Professor',
      reason: 'Testing invalid faculty registration'
    });

    console.log('Registration successful:', response.data);
  } catch (error) {
    console.error('Registration failed (expected):', error.response?.status, error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('Testing student registration with class field...');
  await testStudentRegistration();

  console.log('\nTesting faculty registration with department field...');
  await testFacultyRegistration();

  console.log('\nTesting invalid student registration (department instead of class)...');
  await testInvalidStudentRegistration();

  console.log('\nTesting invalid faculty registration (class instead of department)...');
  await testInvalidFacultyRegistration();
}

runTests();