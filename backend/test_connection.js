const http = require('http');

const req = http.get('http://localhost:3001/test', (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', (d) => console.log('Data:', d.toString()));
});

req.on('error', (e) => {
  console.log('Error:', e.message);
});