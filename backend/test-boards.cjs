const mongoose = require('mongoose');
const Board = require('./models/Board');
const BoardGroup = require('./models/BoardGroup');
require('dotenv').config();

async function testBoardSystem() {
  try {
    console.log('Testing Board Management System...');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');
    console.log('Connected to database');

    // Test Board creation
    console.log('\n1. Testing Board creation...');
    const testBoard = new Board({
      name: 'Test Board',
      description: 'A test display board',
      location: 'Main Building - Floor 1',
      type: 'digital',
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
      },
      assignedUsers: []
    });

    await testBoard.save();
    console.log('✓ Board created successfully:', testBoard._id);

    // Test Board Group creation
    console.log('\n2. Testing Board Group creation...');
    const testGroup = new BoardGroup({
      name: 'Main Building Boards',
      description: 'All boards in the main building',
      type: 'building',
      sharedContent: {
        enabled: true,
        notices: []
      },
      settings: {
        allowSharedContent: true,
        maxBoards: 50
      },
      createdBy: new mongoose.Types.ObjectId() // Dummy user ID
    });

    await testGroup.save();
    console.log('✓ Board Group created successfully:', testGroup._id);

    // Test adding board to group
    console.log('\n3. Testing board-group relationship...');
    await testGroup.addBoard(testBoard._id);
    testBoard.groupId = testGroup._id;
    await testBoard.save();
    console.log('✓ Board added to group successfully');

    // Test content assignment
    console.log('\n4. Testing content assignment...');
    await testBoard.assignContent('507f1f77bcf86cd799439011', 60, 5); // Dummy notice ID
    console.log('✓ Content assigned to board successfully');

    // Test queries
    console.log('\n5. Testing queries...');
    const boards = await Board.find({}).populate('groupId');
    console.log(`✓ Found ${boards.length} boards`);

    const groups = await BoardGroup.find({}).populate('boards');
    console.log(`✓ Found ${groups.length} board groups`);

    // Cleanup
    console.log('\n6. Cleaning up test data...');
    await Board.findByIdAndDelete(testBoard._id);
    await BoardGroup.findByIdAndDelete(testGroup._id);
    console.log('✓ Test data cleaned up');

    console.log('\n🎉 All board system tests passed!');

  } catch (error) {
    console.error('❌ Board system test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the test
testBoardSystem();