// MQTT Client for Backend (Node.js)
// This connects to Mosquitto broker and handles ESP32 communication

const mqtt = require('mqtt');

// MQTT Broker settings
const brokerUrl = 'mqtt://localhost:1883'; // Mosquitto running locally
const options = {
  clientId: 'backend_server',
  clean: true,
  connectTimeout: 4000,
  username: '', // Add if authentication is enabled
  password: '', // Add if authentication is enabled
  reconnectPeriod: 1000,
};

// Topics
const switchTopic = 'esp32/switches';
const stateTopic = 'esp32/state';

const client = mqtt.connect(brokerUrl, options);

client.on('connect', () => {
  console.log('Connected to MQTT broker');

  // Subscribe to ESP32 state updates
  client.subscribe(stateTopic, (err) => {
    if (!err) {
      console.log(`Subscribed to ${stateTopic}`);
    }
  });
});

client.on('message', (topic, message) => {
  console.log(`Received message on ${topic}: ${message.toString()}`);

  if (topic === stateTopic) {
    // Handle ESP32 state updates
    // Example: "relay1:on,relay2:off"
    const states = message.toString().split(',');
    states.forEach(state => {
      const [relay, status] = state.split(':');
      console.log(`${relay} is ${status}`);
      // Update your database or emit to frontend via Socket.IO
    });
  }
});

client.on('error', (error) => {
  console.error('MQTT connection error:', error);
});

client.on('offline', () => {
  console.log('MQTT client is offline');
});

client.on('reconnect', () => {
  console.log('Reconnecting to MQTT broker...');
});

// Function to send switch commands to ESP32
function sendSwitchCommand(relay, state) {
  const message = `${relay}:${state}`;
  client.publish(switchTopic, message);
  console.log(`Sent command: ${message}`);
}

// Example usage (you can call this from your API routes)
setTimeout(() => {
  sendSwitchCommand('relay1', 'on');
}, 5000);

setTimeout(() => {
  sendSwitchCommand('relay1', 'off');
}, 10000);

module.exports = { sendSwitchCommand };