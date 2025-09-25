// MQTT Test Script
// Run this to test MQTT communication between backend and ESP32

const mqtt = require('mqtt');

// Connect to Mosquitto broker
const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'test_client',
  clean: true,
});

client.on('connect', () => {
  console.log('Test client connected to MQTT broker');

  // Subscribe to ESP32 state topic
  client.subscribe('esp32/state', (err) => {
    if (!err) {
      console.log('Subscribed to esp32/state');
    }
  });

  // Send test commands
  console.log('Sending test commands...');
  setTimeout(() => {
    client.publish('esp32/switches', 'relay1:on');
    console.log('Sent: relay1:on');
  }, 1000);

  setTimeout(() => {
    client.publish('esp32/switches', 'relay1:off');
    console.log('Sent: relay1:off');
  }, 3000);

  setTimeout(() => {
    client.publish('esp32/switches', 'relay2:on');
    console.log('Sent: relay2:on');
  }, 5000);

  // Disconnect after 10 seconds
  setTimeout(() => {
    console.log('Test completed, disconnecting...');
    client.end();
  }, 10000);
});

client.on('message', (topic, message) => {
  console.log(`Received: ${topic} - ${message.toString()}`);
});

client.on('error', (error) => {
  console.error('MQTT error:', error);
});