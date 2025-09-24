
const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Schedule = require('../models/Schedule');
const scheduleService = require('../services/scheduleService');
const { handleValidationErrors } = require('../middleware/validationHandler');
const { body, param } = require('express-validator');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all schedules
router.get('/', async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate('createdBy', 'name email')
      .populate('switches.deviceId', 'name location classroom');
    
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create schedule
router.post('/', 
  authorize('admin', 'faculty'),
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Schedule name is required')
      .isLength({ max: 100 })
      .withMessage('Schedule name must be less than 100 characters'),
    body('time')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid time format required (HH:MM)'),
    body('action')
      .isIn(['on', 'off'])
      .withMessage('Action must be either "on" or "off"'),
    body('type')
      .isIn(['once', 'daily', 'weekly'])
      .withMessage('Invalid schedule type'),
    body('days')
      .optional()
      .isArray()
      .withMessage('Days must be an array'),
    body('days.*')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage('Day must be a number between 0 and 6 (0=Sunday, 6=Saturday)'),
    body('switches')
      .isArray({ min: 1 })
      .withMessage('At least one switch is required'),
    body('switches.*.deviceId')
      .isMongoId()
      .withMessage('Valid device ID is required'),
    body('switches.*.switchId')
      .isString()
      .withMessage('Switch ID must be a string'),
    body('timeoutMinutes')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Timeout minutes must be a non-negative integer')
  ],
  handleValidationErrors,
  async (req, res) => {
  try {
    const schedule = await Schedule.create({
      ...req.body,
      createdBy: req.user.id
    });

    scheduleService.addSchedule(schedule);

    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update schedule
router.put('/:id', 
  authorize('admin', 'faculty'),
  [
    param('id')
      .isMongoId()
      .withMessage('Valid schedule ID is required'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Schedule name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Schedule name must be less than 100 characters'),
    body('time')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid time format required (HH:MM)'),
    body('action')
      .optional()
      .isIn(['on', 'off'])
      .withMessage('Action must be either "on" or "off"'),
    body('type')
      .optional()
      .isIn(['once', 'daily', 'weekly'])
      .withMessage('Invalid schedule type'),
    body('days')
      .optional()
      .isArray()
      .withMessage('Days must be an array'),
    body('days.*')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage('Day must be a number between 0 and 6 (0=Sunday, 6=Saturday)'),
    body('switches')
      .optional()
      .isArray({ min: 1 })
      .withMessage('At least one switch is required'),
    body('switches.*.deviceId')
      .optional()
      .isMongoId()
      .withMessage('Valid device ID is required'),
    body('switches.*.switchId')
      .optional()
      .isString()
      .withMessage('Switch ID must be a string'),
    body('timeoutMinutes')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Timeout minutes must be a non-negative integer')
  ],
  handleValidationErrors,
  async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    scheduleService.updateSchedule(schedule);

    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Toggle schedule enabled flag (frontend calls this route)
router.put('/:id/toggle', 
  authorize('admin', 'faculty'),
  [
    param('id')
      .isMongoId()
      .withMessage('Valid schedule ID is required')
  ],
  handleValidationErrors,
  async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    schedule.enabled = !schedule.enabled;
    await schedule.save();

    // Update associated cron job
    scheduleService.updateSchedule(schedule);

    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Run schedule immediately (for testing/debugging)
router.post('/:id/run', 
  authorize('admin', 'faculty'),
  [
    param('id')
      .isMongoId()
      .withMessage('Valid schedule ID is required')
  ],
  handleValidationErrors,
  async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    await scheduleService.executeSchedule(schedule);
    res.json({ success: true, message: 'Schedule executed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete schedule
router.delete('/:id', 
  authorize('admin', 'faculty'),
  [
    param('id')
      .isMongoId()
      .withMessage('Valid schedule ID is required')
  ],
  handleValidationErrors,
  async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    scheduleService.removeJob(req.params.id);

    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
