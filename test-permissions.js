import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the RolePermissions model
const RolePermissions = (await import('./backend/models/RolePermissions.js')).default;

async function testPermissions() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/aim_smart_class', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Create a test role permissions document
    const testRole = new RolePermissions({
      role: 'super-admin'
    });

    console.log('Before setDefaultPermissionsForRole:');
    console.log('userManagement.canViewUsers:', testRole.userManagement.canViewUsers);

    // Call the method
    testRole.setDefaultPermissionsForRole();

    console.log('After setDefaultPermissionsForRole:');
    console.log('userManagement.canViewUsers:', testRole.userManagement.canViewUsers);
    console.log('deviceManagement.canViewDevices:', testRole.deviceManagement.canViewDevices);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Error:', error);
  }
}

testPermissions();