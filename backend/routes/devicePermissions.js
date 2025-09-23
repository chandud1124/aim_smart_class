const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
    grantDevicePermission,
    getUserDevicePermissions,
    updateDevicePermission,
    revokeDevicePermission,
    getDevicePermissionsSummary,
    grantTemporaryOverride
} = require('../controllers/devicePermissionController');

// Grant device permission to user
router.post('/grant',
    auth,
    authorize('admin', 'super-admin'),
    grantDevicePermission
);

// Get user's device permissions
router.get('/user/:userId',
    auth,
    getUserDevicePermissions
);

// Update device permission
router.put('/:permissionId',
    auth,
    authorize('admin', 'super-admin'),
    updateDevicePermission
);

// Revoke device permission
router.delete('/:permissionId',
    auth,
    authorize('admin', 'super-admin'),
    revokeDevicePermission
);

// Get device permissions summary (admin only)
router.get('/summary',
    auth,
    authorize('admin', 'super-admin'),
    getDevicePermissionsSummary
);

// Grant temporary override (admin only)
router.post('/:permissionId/override',
    auth,
    authorize('admin', 'super-admin'),
    grantTemporaryOverride
);

module.exports = router;
