const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3001/esp32-ws');

ws.on('open', () => {
  console.log('Test client: Connected to WebSocket');

  // Skip identification and send manual switch message directly
  const testMessage = {
    type: 'manual_switch',
    mac: 'AA:BB:CC:DD:EE:FF',
    gpio: 4,
    action: 'manual_on',
    previousState: 'off',
    newState: 'on',
    detectedBy: 'gpio_interrupt',
    physicalPin: 14,
    timestamp: Date.now()
  };
  ws.send(JSON.stringify(testMessage));
  console.log('Test client: Sent manual_switch message (skipping identification)');

  setTimeout(() => {
    ws.close();
    console.log('Test client: Closed connection');
    process.exit(0);
  }, 3000);
});

ws.on('message', (data) => {
  console.log('Test client received:', data.toString());
});

ws.on('error', (err) => {
  console.error('Test client WebSocket error:', err.message);
  process.exit(1);
});