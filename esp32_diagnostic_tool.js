#!/usr/bin/env node

// ESP32 Connectivity Diagnostic Tool
// Helps diagnose why ESP32 shows offline despite being connected

const ping = require('ping');
const axios = require('axios');

console.log('🔧 ESP32 CONNECTIVITY DIAGNOSTIC TOOL\n');

// Configuration from ESP32 code
const ESP32_CONFIG = {
  wifiSSID: 'AIMS-WIFI',
  wifiPassword: 'Aimswifi#2025',
  backendHost: '172.16.3.56',
  backendPort: 3001,
  wsPath: '/esp32-ws',
  heartbeatInterval: 30000, // 30 seconds
  deviceSecret: '9545c46f0f9f494a27412fce1f5b22095550c4e88d82868f'
};

// Common ESP32 IP ranges (adjust based on your router)
const COMMON_ESP32_IPS = [
  '172.16.3.181',  // Known from previous logs
  '172.16.3.182',  // Known from previous logs
  '192.168.1.100', '192.168.1.101', '192.168.1.102',
  '192.168.4.1',   // ESP32 AP mode
  '10.0.0.100', '10.0.0.101', '10.0.0.102'
];

async function pingHost(host) {
  try {
    const result = await ping.promise.probe(host, {
      timeout: 3,
      extra: ['-c', '3']
    });
    return {
      host,
      alive: result.alive,
      time: result.time,
      packetLoss: result.packetLoss
    };
  } catch (error) {
    return {
      host,
      alive: false,
      error: error.message
    };
  }
}

async function checkBackendHealth() {
  try {
    const response = await axios.get(`http://${ESP32_CONFIG.backendHost}:${ESP32_CONFIG.backendPort}/health`, {
      timeout: 5000
    });
    return {
      status: 'healthy',
      data: response.data
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.response?.data || error.message
    };
  }
}

async function checkWebSocketEndpoint() {
  try {
    // Try to connect to WebSocket endpoint (will fail but shows if port is open)
    const response = await axios.get(`http://${ESP32_CONFIG.backendHost}:${ESP32_CONFIG.backendPort}${ESP32_CONFIG.wsPath}`, {
      timeout: 3000
    });
    return { accessible: true, response: response.status };
  } catch (error) {
    // WebSocket endpoints typically return 400 for HTTP requests, which is normal
    if (error.response && error.response.status === 400) {
      return { accessible: true, note: 'WebSocket endpoint responding (400 expected for HTTP)' };
    }
    return { accessible: false, error: error.message };
  }
}

async function scanForESP32Devices() {
  console.log('🔍 Scanning for ESP32 devices...\n');
  
  const results = [];
  for (const ip of COMMON_ESP32_IPS) {
    process.stdout.write(`Pinging ${ip}... `);
    const result = await pingHost(ip);
    console.log(result.alive ? `✅ ALIVE (${result.time}ms)` : '❌ NO RESPONSE');
    results.push(result);
  }
  
  return results.filter(r => r.alive);
}

async function diagnoseNetworkIssues() {
  console.log('📊 NETWORK DIAGNOSTIC RESULTS\n');
  
  // 1. Check backend connectivity
  console.log('1️⃣ Backend Server Health:');
  const backendHealth = await checkBackendHealth();
  if (backendHealth.status === 'healthy') {
    console.log(`   ✅ Backend server is healthy`);
    console.log(`   📊 Uptime: ${backendHealth.data.uptime?.toFixed(2)}s`);
    console.log(`   🗄️  Database: ${backendHealth.data.database}`);
  } else {
    console.log(`   ❌ Backend server unhealthy: ${backendHealth.error}`);
  }
  console.log('');
  
  // 2. Check WebSocket endpoint
  console.log('2️⃣ WebSocket Endpoint:');
  const wsCheck = await checkWebSocketEndpoint();
  if (wsCheck.accessible) {
    console.log(`   ✅ WebSocket endpoint accessible`);
    if (wsCheck.note) console.log(`   📝 ${wsCheck.note}`);
  } else {
    console.log(`   ❌ WebSocket endpoint not accessible: ${wsCheck.error}`);
  }
  console.log('');
  
  // 3. Scan for ESP32 devices
  console.log('3️⃣ ESP32 Device Discovery:');
  const aliveDevices = await scanForESP32Devices();
  
  if (aliveDevices.length > 0) {
    console.log(`\n   ✅ Found ${aliveDevices.length} responsive device(s):`);
    aliveDevices.forEach(device => {
      console.log(`   📱 ${device.host} - ${device.time}ms response time`);
    });
  } else {
    console.log(`\n   ❌ No ESP32 devices found on common IP addresses`);
  }
  console.log('');
  
  // 4. Check network configuration
  console.log('4️⃣ Network Configuration Analysis:');
  console.log(`   📡 WiFi SSID: ${ESP32_CONFIG.wifiSSID}`);
  console.log(`   🖥️  Backend Host: ${ESP32_CONFIG.backendHost}:${ESP32_CONFIG.backendPort}`);
  console.log(`   🔗 WebSocket Path: ${ESP32_CONFIG.wsPath}`);
  console.log(`   💓 Heartbeat Interval: ${ESP32_CONFIG.heartbeatInterval / 1000}s`);
  console.log('');
  
  return { backendHealth, wsCheck, aliveDevices };
}

async function provideTroubleshootingSteps(diagnosticResults) {
  console.log('🔧 TROUBLESHOOTING RECOMMENDATIONS\n');
  
  const { backendHealth, wsCheck, aliveDevices } = diagnosticResults;
  
  if (backendHealth.status !== 'healthy') {
    console.log('⚠️  BACKEND SERVER ISSUES:');
    console.log('   1. Check if backend server is running');
    console.log('   2. Verify port 3001 is not blocked by firewall');
    console.log('   3. Check MongoDB connection');
    console.log('   4. Review server logs for errors');
    console.log('');
  }
  
  if (!wsCheck.accessible) {
    console.log('⚠️  WEBSOCKET CONNECTIVITY ISSUES:');
    console.log('   1. Verify WebSocket server is running on port 3001');
    console.log('   2. Check firewall settings');
    console.log('   3. Test with: telnet 172.16.3.56 3001');
    console.log('');
  }
  
  if (aliveDevices.length === 0) {
    console.log('⚠️  ESP32 DEVICE CONNECTIVITY ISSUES:');
    console.log('   1. Check ESP32 power supply');
    console.log('   2. Verify WiFi credentials match router');
    console.log('   3. Check WiFi signal strength');
    console.log('   4. Look for IP conflicts');
    console.log('   5. Check router DHCP settings');
    console.log('   6. Try different ESP32 IP range');
    console.log('');
  }
  
  console.log('📋 COMMON ESP32 OFFLINE CAUSES:\n');
  
  console.log('🔴 Network Layer Issues:');
  console.log('   • Wrong WiFi SSID/Password');
  console.log('   • Router DHCP exhaustion');
  console.log('   • IP address conflicts');
  console.log('   • Weak WiFi signal');
  console.log('   • Router firewall blocking ESP32');
  console.log('');
  
  console.log('🟡 Application Layer Issues:');
  console.log('   • Backend server down/crashed');
  console.log('   • WebSocket endpoint not responding');
  console.log('   • Authentication failures');
  console.log('   • Heartbeat timeout');
  console.log('   • Command queue overflow');
  console.log('');
  
  console.log('🟠 ESP32 Hardware Issues:');
  console.log('   • Power supply instability');
  console.log('   • Overheating causing resets');
  console.log('   • Memory leaks/heap exhaustion');
  console.log('   • Watchdog timer resets');
  console.log('   • Flash memory corruption');
  console.log('');
  
  console.log('💡 IMMEDIATE ACTION STEPS:\n');
  
  console.log('1️⃣ Check ESP32 Serial Output:');
  console.log('   Connect USB cable and monitor serial at 115200 baud');
  console.log('   Look for: WiFi connection, WebSocket status, error messages');
  console.log('');
  
  console.log('2️⃣ Verify Network Connectivity:');
  console.log('   • Ping ESP32 IP address');
  console.log('   • Check router DHCP client list');
  console.log('   • Verify subnet and gateway settings');
  console.log('');
  
  console.log('3️⃣ Test Backend Connection:');
  console.log(`   curl http://${ESP32_CONFIG.backendHost}:${ESP32_CONFIG.backendPort}/health`);
  console.log('   Check WebSocket with browser dev tools');
  console.log('');
  
  console.log('4️⃣ Reset ESP32 Configuration:');
  console.log('   • Power cycle ESP32');
  console.log('   • Clear NVS (erase flash)');
  console.log('   • Reflash firmware if necessary');
  console.log('');
  
  console.log('5️⃣ Check for Multiple User Conflicts:');
  console.log('   • Review backend logs for simultaneous commands');
  console.log('   • Check for WebSocket connection limits');
  console.log('   • Verify device authentication uniqueness');
  console.log('');
}

// Main diagnostic function
async function runDiagnostics() {
  console.log('Starting ESP32 connectivity diagnostics...\n');
  
  try {
    const results = await diagnoseNetworkIssues();
    await provideTroubleshootingSteps(results);
    
    console.log('✅ Diagnostic complete. Check serial monitor on ESP32 for detailed logs.');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    console.log('\n🔧 Manual troubleshooting steps:');
    console.log('1. Check network connectivity manually');
    console.log('2. Verify backend server status');
    console.log('3. Monitor ESP32 serial output');
    console.log('4. Check router configuration');
  }
}

// Install required packages if missing
async function checkDependencies() {
  try {
    require('ping');
    require('axios');
    return true;
  } catch (error) {
    console.log('📦 Installing required packages...');
    console.log('Run: npm install ping axios');
    return false;
  }
}

// Run diagnostics if dependencies are available
if (require.main === module) {
  runDiagnostics();
}

module.exports = { runDiagnostics, pingHost, checkBackendHealth };
