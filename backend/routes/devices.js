
const express = require('express');
const { auth, authorize, checkDeviceAccess } = require('../middleware/auth');
const { validateDevice, validateDeviceUpdate } = require('../middleware/deviceValidator');
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
  getDeviceById,
  getGpioPinInfo,
  validateGpioConfig
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
router.post('/', authorize('admin', 'super-admin'), validateDevice, handleValidationErrors, createDevice);
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
router.put('/:deviceId', authorize('admin', 'principal', 'dean', 'hod', 'faculty'), checkDeviceAccess, validateDeviceUpdate, updateDevice);
router.delete('/:deviceId', authorize('admin'), checkDeviceAccess, deleteDevice);

// Switch operations with enhanced permission checking
router.post('/:deviceId/switches/:switchId/toggle',
  checkDevicePermission('canTurnOn'), // Requires canTurnOn permission
  incrementUsage, // Track usage
  toggleSwitch
);

// Device control with specific permissions
router.post('/:deviceId/control',
  checkDevicePermission('canModifySettings'),
  checkValueLimits, // Check brightness/speed limits
  incrementUsage,
  require('../controllers/deviceController').controlDevice
);

// Device scheduling
router.post('/:deviceId/schedule',
  checkDevicePermission('canSchedule'),
  require('../controllers/deviceController').scheduleDevice
);

// Device history access
router.get('/:deviceId/history',
  checkDevicePermission('canViewHistory'),
  require('../controllers/deviceController').getDeviceHistory
);

// PIR sensor configuration
router.post('/:deviceId/pir/configure',
  checkDevicePermission('canConfigurePir'),
  require('../controllers/deviceController').configurePir
);

// GPIO pin information and validation
router.get('/gpio-info', getGpioPinInfo);
router.get('/gpio-info/:deviceId', getGpioPinInfo);
router.post('/validate-gpio', validateGpioConfig);

// PIR sensor data access
router.get('/:deviceId/pir/data',
  checkDevicePermission('canViewPirData'),
  require('../controllers/deviceController').getPirData
);

// MQTT switch command - DISABLED (keeping for safety/fallback only)
/*
router.post('/mqtt/switch/:relay/:state', authorize('admin', 'principal', 'dean', 'hod', 'faculty'), (req, res) => {
  const { relay, state } = req.params;
  if (!global.sendMqttSwitchCommand) {
    return res.status(500).json({ error: 'MQTT client not available' });
  }
  try {
    global.sendMqttSwitchCommand(relay, state);
    res.json({ success: true, message: `MQTT command sent: ${relay}:${state}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send MQTT command' });
  }
});
*/

console.log('[MQTT] MQTT switch command route disabled - using WebSocket communication only');

module.exports = router;
