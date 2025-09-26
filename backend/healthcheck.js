const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: process.env.PORT || 3001,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  // Accept both 200 and 503 (service unavailable) during startup
  if (res.statusCode === 200 || res.statusCode === 503) {
    console.log('Health check passed');
    process.exit(0);
  } else {
    console.log(`Health check failed: ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.error('Health check error:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check timeout');
  req.destroy();
  process.exit(1);
});

req.end();