async function testInitializeEndpoint() {
  try {
    const response = await fetch('http://localhost:3003/api/role-permissions/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OTgwMDNlZjA5MjIzNmU4NjBlYzVmYSIsImlhdCI6MTc1ODIxNjY4OSwiZXhwIjoxNzU4ODIxNDg5fQ.8ZEj0CttXByZDfI6z3e-N6Dkfio-0ty16S6T5S0KCtg'
      }
    });
    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testInitializeEndpoint();