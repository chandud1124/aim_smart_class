import mongoose from 'mongoose';
import { RolePermissions } from './backend/models/RolePermissions.js';

async function testRolePermissions() {
  try {
    // Connect to MongoDB (you'll need to update the connection string)
    await mongoose.connect('mongodb://localhost:27017/aim_smart_class', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Test the setDefaultPermissionsForRole method
    const superAdminPermissions = new RolePermissions({ role: 'super-admin' });
    superAdminPermissions.setDefaultPermissionsForRole();

    console.log('Super Admin Permissions:');
    console.log('canViewUsers:', superAdminPermissions.userManagement.canViewUsers);
    console.log('canViewDevices:', superAdminPermissions.deviceManagement.canViewDevices);
    console.log('canViewClassrooms:', superAdminPermissions.classroomManagement.canViewClassrooms);

    // Test dean permissions
    const deanPermissions = new RolePermissions({ role: 'dean' });
    deanPermissions.setDefaultPermissionsForRole();

    console.log('\nDean Permissions:');
    console.log('canViewUsers:', deanPermissions.userManagement.canViewUsers);
    console.log('canViewDevices:', deanPermissions.deviceManagement.canViewDevices);
    console.log('canViewClassrooms:', deanPermissions.classroomManagement.canViewClassrooms);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Error:', error);
  }
}

testRolePermissions();