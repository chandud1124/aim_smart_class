import http from 'http';
import https from 'https';

const tests = [
  {
    name: 'Backend API Health Check',
    url: 'http://172.16.3.171:3001/api/health',
    method: 'GET'
  },
  {
    name: 'Frontend Static Access',
    url: 'http://172.16.3.171:5173/',
    method: 'GET'
  },
  {
    name: 'Backend CORS Pre-flight',
    url: 'http://172.16.3.171:3001/api/devices',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://172.16.3.171:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization'
    }
  }
];

async function testEndpoint(test) {
  return new Promise((resolve) => {
    const protocol = test.url.startsWith('https:') ? https : http;
    const url = new URL(test.url);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: test.method,
      headers: test.headers || {},
      timeout: 5000
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          name: test.name,
          status: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 400,
          headers: res.headers,
          data: data.substring(0, 200)
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        name: test.name,
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: test.name,
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function runNetworkTests() {
  console.log('🔬 Running Network Accessibility Tests...\n');
  console.log(`📍 System IP: 172.16.3.171`);
  console.log(`🖥️  Frontend: http://172.16.3.171:5173/`);
  console.log(`⚙️  Backend:  http://172.16.3.171:3001/\n`);

  const results = [];
  for (const test of tests) {
    const result = await testEndpoint(test);
    results.push(result);
    
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    
    if (result.success) {
      console.log(`   Status: ${result.status}`);
      if (result.headers && result.headers['access-control-allow-origin']) {
        console.log(`   CORS: ${result.headers['access-control-allow-origin']}`);
      }
    } else {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  }

  const allPassed = results.every(r => r.success);
  console.log(`\n🎯 Test Summary: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log(`✅ Passed: ${results.filter(r => r.success).length}/${results.length}`);
  
  if (allPassed) {
    console.log('\n🌐 Your system is accessible from any device on the same WiFi network!');
    console.log('📱 Access from mobile: http://172.16.3.171:5173/');
    console.log('💻 Access from another PC: http://172.16.3.171:5173/');
  }
}

runNetworkTests();
