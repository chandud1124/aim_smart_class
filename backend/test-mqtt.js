const mqtt = require('mqtt');
console.log('Testing MQTT connection to localhost:3002...');
const client = mqtt.connect('mqtt://localhost:3002', { clientId: 'test-client-localhost' });
client.on('connect', () => {
  console.log('✅ SUCCESS: MQTT client connected to localhost:3002');
  client.end();
});
client.on('error', (err) => {
  console.log('❌ FAILED: MQTT client connection to localhost:3002 failed:', err.message);
  client.end();
});
setTimeout(() => {
  console.log('⏰ TIMEOUT: Connection to localhost:3002 taking too long');
  client.end();
}, 3000);