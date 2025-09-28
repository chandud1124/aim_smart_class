#!/usr/bin/env node
/**
 * Test script to verify Raspberry Pi board functionality
 * Run this after updating the BoardManager component
 */

import axios from 'axios';

const BASE_URL = 'http://172.16.3.171:3001/api';
const TEST_BOARD = {
  name: 'Test Raspberry Pi Display',
  description: 'A test Raspberry Pi display board',
  location: 'Test Lab - Room 101',
  type: 'raspberry_pi',
  status: 'active',
  macAddress: 'B8:27:EB:12:34:56',
  ipAddress: '192.168.1.100',
  displaySettings: {
    resolution: '1920x1080',
    orientation: 'landscape',
    brightness: 80
  },
  schedule: {
    operatingHours: {
      start: '08:00',
      end: '18:00'
    }
  }
};

async function testRaspberryPiBoardCreation() {
  try {
    console.log('🧪 Testing Raspberry Pi Board Creation...\n');

    // First, try to login as admin (you'll need to replace with actual credentials)
    console.log('1. Attempting to login...');
    console.log('Making login request to:', `${BASE_URL}/auth/login`);
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@iotclassroom.com', // Correct admin email from database
      password: 'admin123456'     // Default admin password from server.js
    });
    console.log('Login response status:', loginResponse.status);
    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Set authorization header for subsequent requests
    const headers = { Authorization: `Bearer ${token}` };

    // Create a Raspberry Pi board
    console.log('2. Creating Raspberry Pi board...');
    const createResponse = await axios.post(`${BASE_URL}/boards`, TEST_BOARD, { headers });
    const boardId = createResponse.data.data._id;
    console.log('✅ Board created successfully');
    console.log(`   Board ID: ${boardId}`);
    console.log(`   Type: ${createResponse.data.data.type}\n`);

    // Fetch all boards to verify it appears in the list
    console.log('3. Fetching all boards...');
    const boardsResponse = await axios.get(`${BASE_URL}/boards`, { headers });
    const boards = boardsResponse.data.data;
    const raspberryPiBoards = boards.filter(board => board.type === 'raspberry_pi');

    console.log(`✅ Found ${boards.length} total boards`);
    console.log(`✅ Found ${raspberryPiBoards.length} Raspberry Pi boards`);

    // Verify our board is in the list
    const ourBoard = boards.find(board => board._id === boardId);
    if (ourBoard) {
      console.log('✅ Our Raspberry Pi board found in the list');
      console.log(`   Name: ${ourBoard.name}`);
      console.log(`   MAC: ${ourBoard.macAddress}`);
      console.log(`   IP: ${ourBoard.ipAddress}`);
    }

    // Test board content endpoint
    console.log('\n4. Testing board content endpoint...');
    const contentResponse = await axios.get(`${BASE_URL}/boards/${boardId}/content`, { headers });
    console.log('✅ Board content endpoint accessible');
    console.log(`   Content structure: ${Object.keys(contentResponse.data.data).join(', ')}`);

    // Clean up - delete the test board
    console.log('\n5. Cleaning up test board...');
    await axios.delete(`${BASE_URL}/boards/${boardId}`, { headers });
    console.log('✅ Test board deleted');

    console.log('\n🎉 All tests passed! Raspberry Pi board functionality is working.');

  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Request details:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the backend server is running on port 3001');
    console.log('2. Update the login credentials in this script');
    console.log('3. Check that the BoardManager component has been updated');
    console.log('4. Verify the backend Board model supports raspberry_pi type');
  }
}

// Run the test
testRaspberryPiBoardCreation();