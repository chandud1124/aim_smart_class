const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const BulkOperations = require('../utils/bulkOperations');
const { logger } = require('../middleware/logger');
const Device = require('../models/Device');
const { handleValidationErrors } = require('../middleware/validationHandler');
const { body } = require('express-validator');

// Bulk create devices
router.post('/devices', 
  auth, 
  authorize('admin', 'super-admin'),
  [
    body('devices')
      .isArray({ min: 1 })
      .withMessage('Devices must be a non-empty array'),
    body('devices.*.name')
      .trim()
      .notEmpty()
      .withMessage('Device name is required')
      .isLength({ max: 100 })
      .withMessage('Device name must be less than 100 characters'),
    body('devices.*.macAddress')
      .trim()
      .notEmpty()
      .withMessage('MAC address is required')
      .matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
      .withMessage('Invalid MAC address format'),
    body('devices.*.ipAddress')
      .trim()
      .notEmpty()
      .withMessage('IP address is required')
      .matches(/^(\d{1,3}\.){3}\d{1,3}$/)
      .withMessage('Invalid IP address format'),
    body('devices.*.location')
      .trim()
      .notEmpty()
      .withMessage('Location is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
        const results = await BulkOperations.bulkCreateDevices(req.body.devices, req.user.id);
        res.json({
            message: 'Bulk device creation completed',
            results
        });
    } catch (error) {
        logger.error('Bulk device creation failed:', error);
        res.status(500).json({
            error: 'Bulk operation failed',
            message: error.message
        });
    }
});

// Bulk toggle switches
router.post('/toggle', 
  auth,
  [
    body('devices')
      .isArray({ min: 1 })
      .withMessage('Devices must be a non-empty array'),
    body('switchId')
      .isInt({ min: 0 })
      .withMessage('Switch ID must be a non-negative integer'),
    body('state')
      .isBoolean()
      .withMessage('State must be a boolean value')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
        const { devices, switchId, state } = req.body;

        const results = await BulkOperations.bulkToggleSwitches(devices, switchId, state, req);

        // Send real-time updates through WebSocket for all affected devices
        const io = req.app.get('io');
        results.successful.forEach(result => {
            io.to(`device:${result.deviceId}`).emit('device:update', {
                type: 'switch_state',
                deviceId: result.deviceId,
                switchId: result.switchId,
                state: result.newState
            });
        });

        res.json({
            message: 'Bulk toggle operation completed',
            results
        });
    } catch (error) {
        logger.error('Bulk toggle operation failed:', error);
        res.status(500).json({
            error: 'Bulk operation failed',
            message: error.message
        });
    }
});

// Bulk update devices
router.put('/devices', 
  auth, 
  authorize('admin', 'super-admin'),
  [
    body('updates')
      .isArray({ min: 1 })
      .withMessage('Updates must be a non-empty array'),
    body('updates.*.deviceId')
      .isMongoId()
      .withMessage('Valid device ID is required'),
    body('updates.*.updates')
      .isObject()
      .withMessage('Updates must be an object')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
        const results = await BulkOperations.bulkUpdateDevices(req.body.updates);
        res.json({
            message: 'Bulk device update completed',
            results
        });
    } catch (error) {
        logger.error('Bulk device update failed:', error);
        res.status(500).json({
            error: 'Bulk operation failed',
            message: error.message
        });
    }
});

module.exports = router;
