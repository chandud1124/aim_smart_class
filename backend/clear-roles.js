const mongoose = require('mongoose');
const RolePermissions = require('./models/RolePermissions');

// Connect to MongoDB
async function clearAndReinitializeRoles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aim_smart_class');

    console.log('Connected to MongoDB');

    // Clear all existing role permissions
    await RolePermissions.deleteMany({});
    console.log('Cleared all existing role permissions');

    // Create new role permissions with correct roles
    const roles = ['super-admin', 'dean', 'admin', 'faculty', 'teacher', 'student', 'security', 'guest'];

    for (const role of roles) {
      const rolePermissions = new RolePermissions({
        role,
        metadata: {
          createdBy: 'system',
          lastModifiedBy: 'system',
          isSystemRole: ['super-admin', 'admin'].includes(role)
        }
      });

      // Set default permissions for the role
      rolePermissions.setDefaultPermissionsForRole();
      await rolePermissions.save();
      console.log(`Created role permissions for: ${role}`);
    }

    console.log('Successfully reinitialized all role permissions');
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearAndReinitializeRoles();