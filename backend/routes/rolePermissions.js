const express = require('express');
const router = express.Router();
const RolePermissions = require('../models/RolePermissions');
const { auth, authorize } = require('../middleware/auth');
const { logger } = require('../middleware/logger');

// All role permissions routes require authentication and admin authorization
router.use(auth);
router.use(authorize('admin'));

// Helper function to sanitize role permissions for client
const toClientRolePermissions = (rp) => ({
  id: rp._id,
  role: rp.role,
  userManagement: rp.userManagement,
  deviceManagement: rp.deviceManagement,
  classroomManagement: rp.classroomManagement,
  scheduleManagement: rp.scheduleManagement,
  activityManagement: rp.activityManagement,
  securityManagement: rp.securityManagement,
  ticketManagement: rp.ticketManagement,
  systemManagement: rp.systemManagement,
  extensionManagement: rp.extensionManagement,
  calendarIntegration: rp.calendarIntegration,
  esp32Management: rp.esp32Management,
  bulkOperations: rp.bulkOperations,
  departmentRestrictions: rp.departmentRestrictions,
  timeRestrictions: rp.timeRestrictions,
  notifications: rp.notifications,
  apiAccess: rp.apiAccess,
  audit: rp.audit,
  metadata: rp.metadata,
  createdAt: rp.createdAt,
  updatedAt: rp.updatedAt
});

// GET /api/role-permissions - Get all role permissions
router.get('/', async (req, res) => {
  try {
    const rolePermissions = await RolePermissions.find({ 'metadata.isActive': true })
      .sort({ role: 1 });

    logger.info(`[ROLE_PERMISSIONS] Retrieved ${rolePermissions.length} role permissions`, {
      userId: req.user.id,
      userName: req.user.name
    });

    res.json({
      success: true,
      data: rolePermissions.map(toClientRolePermissions)
    });
  } catch (error) {
    logger.error('[ROLE_PERMISSIONS] Error fetching role permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching role permissions',
      error: error.message
    });
  }
});

// GET /api/role-permissions/:role - Get permissions for a specific role
router.get('/:role', async (req, res) => {
  try {
    const { role } = req.params;

    if (!['admin', 'principal', 'dean', 'hod', 'faculty', 'supervisor', 'technician', 'operator', 'security', 'student', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const rolePermissions = await RolePermissions.findOne({
      role,
      'metadata.isActive': true
    });

    if (!rolePermissions) {
      return res.status(404).json({
        success: false,
        message: `Role permissions not found for role: ${role}`
      });
    }

    logger.info(`[ROLE_PERMISSIONS] Retrieved permissions for role: ${role}`, {
      userId: req.user.id,
      userName: req.user.name
    });

    res.json({
      success: true,
      data: toClientRolePermissions(rolePermissions)
    });
  } catch (error) {
    logger.error(`[ROLE_PERMISSIONS] Error fetching permissions for role ${req.params.role}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching role permissions',
      error: error.message
    });
  }
});

// POST /api/role-permissions - Create new role permissions
router.post('/', async (req, res) => {
  try {
    const { role, ...permissionsData } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }

    if (!['admin', 'principal', 'dean', 'hod', 'faculty', 'supervisor', 'technician', 'operator', 'security', 'student', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Check if role permissions already exist
    const existing = await RolePermissions.findOne({ role });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Role permissions already exist for role: ${role}`
      });
    }

    // Create new role permissions with default values
    const rolePermissions = new RolePermissions({
      role,
      ...permissionsData,
      metadata: {
        ...permissionsData.metadata,
        createdBy: req.user.id,
        lastModifiedBy: req.user.id
      }
    });

    await rolePermissions.save();

    logger.info(`[ROLE_PERMISSIONS] Created permissions for role: ${role}`, {
      userId: req.user.id,
      userName: req.user.name,
      rolePermissionsId: rolePermissions._id
    });

    res.status(201).json({
      success: true,
      data: toClientRolePermissions(rolePermissions),
      message: `Role permissions created for ${role}`
    });
  } catch (error) {
    logger.error('[ROLE_PERMISSIONS] Error creating role permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating role permissions',
      error: error.message
    });
  }
});

// PUT /api/role-permissions/:role - Update permissions for a specific role
router.put('/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const updates = req.body;

    if (!['admin', 'principal', 'dean', 'hod', 'faculty', 'supervisor', 'technician', 'operator', 'security', 'student', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Remove role from updates if present (shouldn't be updated)
    delete updates.role;
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const rolePermissions = await RolePermissions.findOneAndUpdate(
      { role, 'metadata.isActive': true },
      {
        ...updates,
        'metadata.lastModifiedBy': req.user.id
      },
      { new: true, runValidators: true }
    );

    if (!rolePermissions) {
      return res.status(404).json({
        success: false,
        message: `Role permissions not found for role: ${role}`
      });
    }

    logger.info(`[ROLE_PERMISSIONS] Updated permissions for role: ${role}`, {
      userId: req.user.id,
      userName: req.user.name,
      rolePermissionsId: rolePermissions._id,
      changes: Object.keys(updates)
    });

    res.json({
      success: true,
      data: toClientRolePermissions(rolePermissions),
      message: `Role permissions updated for ${role}`
    });
  } catch (error) {
    logger.error(`[ROLE_PERMISSIONS] Error updating permissions for role ${req.params.role}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error updating role permissions',
      error: error.message
    });
  }
});

// PATCH /api/role-permissions/:role - Partially update permissions for a specific role
router.patch('/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const updates = req.body;

    if (!['admin', 'principal', 'dean', 'hod', 'faculty', 'supervisor', 'technician', 'operator', 'security', 'student', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Remove protected fields
    delete updates.role;
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const rolePermissions = await RolePermissions.findOneAndUpdate(
      { role, 'metadata.isActive': true },
      {
        ...updates,
        'metadata.lastModifiedBy': req.user.id
      },
      { new: true, runValidators: true }
    );

    if (!rolePermissions) {
      return res.status(404).json({
        success: false,
        message: `Role permissions not found for role: ${role}`
      });
    }

    logger.info(`[ROLE_PERMISSIONS] Partially updated permissions for role: ${role}`, {
      userId: req.user.id,
      userName: req.user.name,
      rolePermissionsId: rolePermissions._id,
      changes: Object.keys(updates)
    });

    res.json({
      success: true,
      data: toClientRolePermissions(rolePermissions),
      message: `Role permissions updated for ${role}`
    });
  } catch (error) {
    logger.error(`[ROLE_PERMISSIONS] Error partially updating permissions for role ${req.params.role}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error updating role permissions',
      error: error.message
    });
  }
});

// DELETE /api/role-permissions/:role - Soft delete permissions for a specific role
router.delete('/:role', async (req, res) => {
  try {
    const { role } = req.params;

    if (!['admin', 'principal', 'dean', 'hod', 'faculty', 'supervisor', 'technician', 'operator', 'security', 'student', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Prevent deletion of admin role permissions
    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin role permissions'
      });
    }

    const rolePermissions = await RolePermissions.findOneAndUpdate(
      { role, 'metadata.isActive': true },
      {
        'metadata.isActive': false,
        'metadata.lastModifiedBy': req.user.id
      },
      { new: true }
    );

    if (!rolePermissions) {
      return res.status(404).json({
        success: false,
        message: `Role permissions not found for role: ${role}`
      });
    }

    logger.info(`[ROLE_PERMISSIONS] Soft deleted permissions for role: ${role}`, {
      userId: req.user.id,
      userName: req.user.name,
      rolePermissionsId: rolePermissions._id
    });

    res.json({
      success: true,
      message: `Role permissions deactivated for ${role}`
    });
  } catch (error) {
    logger.error(`[ROLE_PERMISSIONS] Error deleting permissions for role ${req.params.role}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error deleting role permissions',
      error: error.message
    });
  }
});

// POST /api/role-permissions/:role/reset - Reset permissions to defaults for a specific role
router.post('/:role/reset', async (req, res) => {
  try {
    const { role } = req.params;

    if (!['admin', 'principal', 'dean', 'hod', 'faculty', 'supervisor', 'technician', 'operator', 'security', 'student', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const rolePermissions = await RolePermissions.findOne({ role, 'metadata.isActive': true });

    if (!rolePermissions) {
      return res.status(404).json({
        success: false,
        message: `Role permissions not found for role: ${role}`
      });
    }

    // Reset to default permissions
    rolePermissions.setDefaultPermissionsForRole();
    rolePermissions.metadata.lastModifiedBy = req.user.id;
    await rolePermissions.save();

    logger.info(`[ROLE_PERMISSIONS] Reset permissions to defaults for role: ${role}`, {
      userId: req.user.id,
      userName: req.user.name,
      rolePermissionsId: rolePermissions._id
    });

    res.json({
      success: true,
      data: toClientRolePermissions(rolePermissions),
      message: `Role permissions reset to defaults for ${role}`
    });
  } catch (error) {
    logger.error(`[ROLE_PERMISSIONS] Error resetting permissions for role ${req.params.role}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error resetting role permissions',
      error: error.message
    });
  }
});

// POST /api/role-permissions/initialize - Initialize default permissions for all roles
router.post('/initialize', async (req, res) => {
  try {
    const roles = ['admin', 'principal', 'dean', 'hod', 'faculty', 'supervisor', 'technician', 'operator', 'security', 'student', 'user'];
    const created = [];
    const updated = [];

    for (const role of roles) {
      let rolePermissions = await RolePermissions.findOne({ role });

      if (!rolePermissions) {
        // Create new role permissions
        rolePermissions = new RolePermissions({
          role,
          metadata: {
            createdBy: req.user.id,
            lastModifiedBy: req.user.id
          }
        });
        await rolePermissions.save();
        created.push(role);
      } else if (!rolePermissions.metadata.isActive) {
        // Reactivate existing permissions
        rolePermissions.metadata.isActive = true;
        rolePermissions.metadata.lastModifiedBy = req.user.id;
        await rolePermissions.save();
        updated.push(role);
      }
    }

    logger.info(`[ROLE_PERMISSIONS] Initialized permissions - Created: ${created.join(', ')}, Updated: ${updated.join(', ')}`, {
      userId: req.user.id,
      userName: req.user.name
    });

    res.json({
      success: true,
      message: 'Role permissions initialized successfully',
      data: {
        created,
        updated,
        totalRoles: roles.length
      }
    });
  } catch (error) {
    logger.error('[ROLE_PERMISSIONS] Error initializing role permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing role permissions',
      error: error.message
    });
  }
});

// GET /api/role-permissions/check/:role/:category/:permission - Check if a role has a specific permission
router.get('/check/:role/:category/:permission', async (req, res) => {
  try {
    const { role, category, permission } = req.params;

    if (!['admin', 'principal', 'dean', 'hod', 'faculty', 'supervisor', 'technician', 'operator', 'security', 'student', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const rolePermissions = await RolePermissions.findOne({
      role,
      'metadata.isActive': true
    });

    if (!rolePermissions) {
      return res.status(404).json({
        success: false,
        message: `Role permissions not found for role: ${role}`
      });
    }

    const hasPermission = rolePermissions.hasPermission(category, permission);

    res.json({
      success: true,
      data: {
        role,
        category,
        permission,
        hasPermission
      }
    });
  } catch (error) {
    logger.error(`[ROLE_PERMISSIONS] Error checking permission for role ${req.params.role}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error checking permission',
      error: error.message
    });
  }
});

module.exports = router;
