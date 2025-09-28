const express = require('express');
const router = express.Router();
const {
  submitNotice,
  getNotices,
  getActiveNotices,
  getPendingNotices,
  reviewNotice,
  publishNotice,
  updateNotice,
  deleteNotice,
  getNoticeStats,
  upload
} = require('../controllers/noticeController');
const { auth, authorize } = require('../middleware/auth');
const { body, param, query } = require('express-validator');

// Validation middleware
const noticeValidation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('category').optional().isIn(['general', 'academic', 'administrative', 'event', 'emergency', 'maintenance']).withMessage('Invalid category'),
  body('expiryDate').optional().isISO8601().withMessage('Invalid expiry date'),
  body('targetAudience').optional().isJSON().withMessage('Invalid target audience format'),
  body('selectedBoards').optional().isArray({ min: 0, max: 5 }).withMessage('Selected boards must be an array with max 5 boards'),
  body('selectedBoards.*').optional().isMongoId().withMessage('Each selected board must be a valid ID')
];

const reviewValidation = [
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
  body('rejectionReason').optional().trim().isLength({ min: 1 }).withMessage('Rejection reason is required')
];

// Routes

// Submit a new notice (any authenticated user)
router.post('/submit',
  auth,
  upload.array('attachments', 5), // Allow up to 5 files
  noticeValidation,
  submitNotice
);

// Get notices (filtered by user permissions)
router.get('/',
  auth,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'published', 'archived']).withMessage('Invalid status'),
    query('category').optional().isIn(['general', 'academic', 'administrative', 'event', 'emergency', 'maintenance']).withMessage('Invalid category'),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
  ],
  getNotices
);

// Get active notices for current user
router.get('/active', auth, getActiveNotices);

// Get pending notices (admin only)
router.get('/pending',
  auth,
  authorize('admin', 'super-admin'),
  getPendingNotices
);

// Review notice (approve/reject) - admin only
router.patch('/:id/review',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid notice ID'),
  reviewValidation,
  reviewNotice
);

// Publish approved notice - admin only
router.patch('/:id/publish',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid notice ID'),
  publishNotice
);

// Update notice
router.patch('/:id',
  auth,
  param('id').isMongoId().withMessage('Invalid notice ID'),
  noticeValidation,
  updateNotice
);

// Delete notice
router.delete('/:id',
  auth,
  param('id').isMongoId().withMessage('Invalid notice ID'),
  deleteNotice
);

// Get notice statistics (admin only)
router.get('/stats/admin',
  auth,
  authorize('admin', 'super-admin'),
  getNoticeStats
);

module.exports = router;