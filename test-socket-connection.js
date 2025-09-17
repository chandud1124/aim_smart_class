// test-socket-connection.js
import { io } from 'socket.io-client';

console.log('🧪 Testing Socket.IO connection...\n');

// Test connection to the backend
const backendUrl = 'http://172.16.3.171:3001';
console.log(`📡 Connecting to: ${backendUrl}`);

const socket = io(backendUrl, {
  transports: ['polling', 'websocket'],
  timeout: 10000,
  forceNew: true,
  auth: {
    token: 'test-token' // You can replace this with a real token if needed
  }
});

let connectionAttempts = 0;
const maxAttempts = 3;

socket.on('connect', () => {
  console.log('✅ Socket.IO connected successfully!');
  console.log(`🔗 Socket ID: ${socket.id}`);
  console.log(`🌐 Transport: ${socket.io.engine.transport.name}`);

  // Test basic functionality
  socket.emit('ping_test', (response) => {
    if (response && response.pong) {
      console.log('🏓 Ping test successful!');
      console.log(`⏱️  Latency: ${Date.now() - response.pong}ms`);
    }
  });

  // Listen for server hello
  socket.on('server_hello', (data) => {
    console.log('📨 Server hello received:', data);
  });

  // Test device state changes
  socket.on('device_state_changed', (data) => {
    console.log('📡 Device state changed:', {
      deviceId: data.deviceId,
      seq: data.seq,
      source: data.source
    });
  });

  // Test device notifications
  socket.on('device_notification', (data) => {
    console.log('🔔 Device notification:', data);
  });

  // Test switch results
  socket.on('switch_result', (data) => {
    console.log('🔄 Switch result:', data);
  });

  setTimeout(() => {
    console.log('\n✅ Socket.IO test completed successfully!');
    console.log('🎉 Connection is working properly.');
    socket.disconnect();
    process.exit(0);
  }, 5000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  connectionAttempts++;

  if (connectionAttempts >= maxAttempts) {
    console.error(`\n💥 Failed to connect after ${maxAttempts} attempts`);
    console.error('🔍 Possible issues:');
    console.error('   - Backend server not running');
    console.error('   - Firewall blocking connection');
    console.error('   - CORS configuration issues');
    console.error('   - Network connectivity problems');
    socket.disconnect();
    process.exit(1);
  } else {
    console.log(`🔄 Retrying connection (${connectionAttempts}/${maxAttempts})...`);
  }
});

socket.on('disconnect', (reason) => {
  console.log(`📴 Disconnected: ${reason}`);
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_error', (error) => {
  console.error('❌ Reconnection error:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('💥 Reconnection failed permanently');
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.error('\n⏰ Connection test timed out after 30 seconds');
  console.error('🔍 This could indicate:');
  console.error('   - Backend server not responding');
  console.error('   - Network timeout issues');
  console.error('   - WebSocket upgrade problems');
  socket.disconnect();
  process.exit(1);
}, 30000);

console.log('⏳ Attempting connection... (timeout: 30s)\n');