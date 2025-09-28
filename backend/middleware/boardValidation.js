const { body } = require('express-validator');

// Board validation rules
const validateBoardCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Board name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Board name can only contain letters, numbers, spaces, hyphens, and underscores'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('location')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),

  body('type')
    .isIn(['digital', 'physical', 'projector', 'tv', 'monitor', 'raspberry_pi'])
    .withMessage('Type must be digital, physical, projector, tv, monitor, or raspberry_pi'),

  body('displaySettings.resolution')
    .optional()
    .matches(/^\d{3,4}x\d{3,4}$/)
    .withMessage('Resolution must be in format like 1920x1080'),

  body('displaySettings.orientation')
    .optional()
    .isIn(['landscape', 'portrait'])
    .withMessage('Orientation must be landscape or portrait'),

  body('displaySettings.brightness')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Brightness must be between 0 and 100'),

  body('schedule.operatingHours.start')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),

  body('schedule.operatingHours.end')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),

  body('groupId')
    .optional()
    .isMongoId()
    .withMessage('Invalid group ID')
];

const validateBoardUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Board name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Board name can only contain letters, numbers, spaces, hyphens, and underscores'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('location')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),

  body('type')
    .optional()
    .isIn(['digital', 'physical', 'projector', 'tv', 'monitor', 'raspberry_pi'])
    .withMessage('Type must be digital, physical, projector, tv, monitor, or raspberry_pi'),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance'])
    .withMessage('Status must be active, inactive, or maintenance'),

  body('displaySettings.resolution')
    .optional()
    .matches(/^\d{3,4}x\d{3,4}$/)
    .withMessage('Resolution must be in format like 1920x1080'),

  body('displaySettings.orientation')
    .optional()
    .isIn(['landscape', 'portrait'])
    .withMessage('Orientation must be landscape or portrait'),

  body('displaySettings.brightness')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Brightness must be between 0 and 100'),

  body('schedule.operatingHours.start')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),

  body('schedule.operatingHours.end')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),

  body('groupId')
    .optional()
    .isMongoId()
    .withMessage('Invalid group ID')
];

// Board Group validation rules
const validateBoardGroupCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Group name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Group name can only contain letters, numbers, spaces, hyphens, and underscores'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('type')
    .isIn(['department', 'location', 'building', 'custom'])
    .withMessage('Type must be department, location, building, or custom')
];

const validateBoardGroupUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Group name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Group name can only contain letters, numbers, spaces, hyphens, and underscores'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('type')
    .optional()
    .isIn(['department', 'location', 'building', 'custom'])
    .withMessage('Type must be department, location, building, or custom')
];

// Content assignment validation
const validateContentAssignment = [
  body('noticeId')
    .optional()
    .isMongoId()
    .withMessage('Invalid notice ID'),

  body('duration')
    .optional()
    .isInt({ min: 5, max: 3600 })
    .withMessage('Duration must be between 5 and 3600 seconds'),

  body('priority')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Priority must be between 0 and 10')
];

// Shared content validation
const validateSharedContentUpdate = [
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('Enabled must be a boolean'),

  body('notices')
    .optional()
    .isArray()
    .withMessage('Notices must be an array'),

  body('notices.*.noticeId')
    .optional()
    .isMongoId()
    .withMessage('Invalid notice ID in shared content'),

  body('notices.*.priority')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Priority must be between 0 and 10'),

  body('notices.*.duration')
    .optional()
    .isInt({ min: 5, max: 3600 })
    .withMessage('Duration must be between 5 and 3600 seconds')
];

module.exports = {
  validateBoardCreation,
  validateBoardUpdate,
  validateBoardGroupCreation,
  validateBoardGroupUpdate,
  validateContentAssignment,
  validateSharedContentUpdate
};