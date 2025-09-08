
const express = require('express');
const { auth, authorize, checkDeviceAccess } = require('../middleware/auth');
const { validateDevice } = require('../middleware/deviceValidator');
const { handleValidationErrors } = require('../middleware/validationHandler');
const { checkDevicePermission, incrementUsage, checkValueLimits } = require('../middleware/devicePermissions');
const { bulkToggleByType, bulkToggleByLocation } = require('../controllers/deviceController');
const {
  getAllDevices,
  createDevice,
  toggleSwitch,
  getDeviceStats,
  updateDevice,
  deleteDevice,
  getDeviceById
} = require('../controllers/deviceController');
const { body, param } = require('express-validator');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Validation middleware
const bulkToggleValidation = [
  body('state').isBoolean().withMessage('State must be a boolean value')
];

const deviceIdValidation = [
  param('id').isMongoId().withMessage('Invalid device ID format')
];

// Device Routes with validation and proper error handling
router.get('/', getAllDevices);
// Restrict creation strictly to admin
router.post('/', authorize('admin'), validateDevice, handleValidationErrors, createDevice);
router.post('/bulk-toggle', authorize('admin', 'principal', 'dean', 'hod', 'faculty'), bulkToggleValidation, handleValidationErrors, require('../controllers/deviceController').bulkToggleSwitches);

// Bulk toggle by type
router.post('/bulk-toggle/type/:type', authorize('admin', 'principal', 'dean', 'hod', 'faculty'), [
  param('type').isIn(['relay', 'light', 'fan', 'outlet', 'projector', 'ac']).withMessage('Invalid device type'),
  ...bulkToggleValidation
], handleValidationErrors, bulkToggleByType);

// Bulk toggle by location
router.post('/bulk-toggle/location/:location', authorize('admin', 'principal', 'dean', 'hod', 'faculty'), [
  param('location').isString().isLength({ min: 1 }).withMessage('Location is required'),
  ...bulkToggleValidation
], handleValidationErrors, bulkToggleByLocation);
router.get('/stats', getDeviceStats);

// Single device operations
router.get('/:deviceId', checkDeviceAccess, getDeviceById);
router.put('/:deviceId', authorize('admin', 'principal', 'dean', 'hod', 'faculty'), checkDeviceAccess, validateDevice, updateDevice);
router.delete('/:deviceId', authorize('admin'), checkDeviceAccess, deleteDevice);

// Switch operations - using existing role-based system for now
router.post('/:deviceId/switches/:switchId/toggle', 
  authorize('admin', 'principal', 'dean', 'hod', 'faculty', 'security', 'student', 'user'), 
  checkDeviceAccess,
  toggleSwitch
);

module.exports = router;
