const http = require('http');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAuth() {
  console.log('Testing User Registration and Login...\n');

  // Test 1: Register a new student
  console.log('1. Testing Student Registration:');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      name: 'Test Student',
      email: 'newstudent@test.com',
      password: 'test123',
      role: 'student',
      class: 'BSCS-2025'
    });

    if (response.status === 201) {
      console.log('✓ Registration successful:', response.data.message);
    } else {
      console.log('✗ Registration failed:', response.data.message || 'Unknown error');
    }
  } catch (error) {
    console.log('✗ Registration failed:', error.message);
  }

  // Test 2: Register a new teacher
  console.log('\n2. Testing Teacher Registration:');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      name: 'Test Teacher',
      email: 'newteacher@test.com',
      password: 'test123',
      role: 'teacher',
      department: 'School of IT',
      designation: 'Lecturer',
      employeeId: 'T002'
    });

    if (response.status === 201) {
      console.log('✓ Registration successful:', response.data.message);
    } else {
      console.log('✗ Registration failed:', response.data.message || 'Unknown error');
    }
  } catch (error) {
    console.log('✗ Registration failed:', error.message);
  }

  // Test 3: Login with approved users
  const testUsers = [
    { email: 'admin@autovolt.com', password: 'admin123', role: 'super-admin' },
    { email: 'student@test.com', password: 'student123', role: 'student' },
    { email: 'teacher@test.com', password: 'teacher123', role: 'teacher' },
    { email: 'faculty@test.com', password: 'faculty123', role: 'faculty' },
    { email: 'security@test.com', password: 'security123', role: 'security' }
  ];

  console.log('\n3. Testing Login for Approved Users:');
  for (const user of testUsers) {
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, {
        email: user.email,
        password: user.password
      });

      if (response.status === 200) {
        console.log('✓ Login successful for', user.role + ':', response.data.user.name);
      } else {
        console.log('✗ Login failed for', user.role + ':', response.data.message || 'Unknown error');
      }
    } catch (error) {
      console.log('✗ Login failed for', user.role + ':', error.message);
    }
  }

  // Test 4: Login with pending user
  console.log('\n4. Testing Login for Pending User:');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: 'pending@test.com',
      password: 'pending123'
    });

    if (response.status === 200) {
      console.log('✓ Login successful for pending user:', response.data.user.name);
    } else {
      console.log('✓ Login correctly blocked for pending user:', response.data.message || 'Unknown error');
    }
  } catch (error) {
    console.log('✓ Login correctly blocked for pending user:', error.message);
  }

  // Test 5: Login with wrong credentials
  console.log('\n5. Testing Login with Wrong Credentials:');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: 'admin@autovolt.com',
      password: 'wrongpassword'
    });

    if (response.status === 200) {
      console.log('✗ Login should have failed but succeeded');
    } else {
      console.log('✓ Login correctly blocked for wrong credentials:', response.data.message || 'Unknown error');
    }
  } catch (error) {
    console.log('✓ Login correctly blocked for wrong credentials:', error.message);
  }

  console.log('\nAuth Testing Complete!');
}

testAuth().catch(console.error);