const express = require('express');
const router = express.Router();
const {
  createScheduledContent,
  getScheduledContent,
  updateScheduledContent,
  deleteScheduledContent,
  getActiveContentForBoard,
  importScheduledContent,
  uploadMediaFiles,
  getUploadedMedia
} = require('../controllers/contentSchedulerController');
const { auth, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');
const multer = require('multer');

// Validation middleware
const contentValidation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters'),
  body('type').isIn(['default', 'user', 'emergency']).withMessage('Invalid content type'),
  body('priority').isInt({ min: 1, max: 10 }).withMessage('Priority must be 1-10'),
  body('duration').isInt({ min: 5, max: 3600 }).withMessage('Duration must be 5-3600 seconds'),
  body('assignedBoards').isArray({ min: 1 }).withMessage('At least one board must be assigned'),
  body('assignedBoards.*').isMongoId().withMessage('Invalid board ID'),
  body('schedule.type').isIn(['fixed', 'recurring', 'always']).withMessage('Invalid schedule type'),
  body('selectedAttachments').optional().isArray().withMessage('Selected attachments must be an array'),
  body('selectedAttachments.*').optional().isString().withMessage('Attachment filenames must be strings')
];

// Routes

// Create scheduled content (admin only)
router.post('/',
  auth,
  authorize('admin', 'super-admin'),
  contentValidation,
  createScheduledContent
);

// Get all scheduled content (admin only)
router.get('/',
  auth,
  authorize('admin', 'super-admin'),
  getScheduledContent
);

// Get active content for a specific board (public route for displays)
router.get('/board/:boardId',
  param('boardId').isMongoId().withMessage('Invalid board ID'),
  getActiveContentForBoard
);

// Update scheduled content (admin only)
router.patch('/:id',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid content ID'),
  [
    body('title').optional().trim().isLength({ min: 1, max: 200 }),
    body('content').optional().trim().isLength({ min: 1, max: 2000 }),
    body('type').optional().isIn(['default', 'user', 'emergency']),
    body('priority').optional().isInt({ min: 1, max: 10 }),
    body('duration').optional().isInt({ min: 5, max: 3600 }),
    body('isActive').optional().isBoolean(),
    body('assignedBoards').optional().isArray(),
    body('assignedBoards.*').optional().isMongoId()
  ],
  updateScheduledContent
);

// Delete scheduled content (admin only)
router.delete('/:id',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid content ID'),
  deleteScheduledContent
);

// Import scheduled content from CSV/Excel (admin only)
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Import media files (admin only)
const mediaUpload = multer({
  dest: 'uploads/media/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
      'audio/mp3', 'audio/wav', 'audio/m4a',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, audio, and documents are allowed.'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit per file
});

router.post('/import',
  auth,
  authorize('admin', 'super-admin'),
  upload.single('file'),
  importScheduledContent
);

// Upload media files for content (admin only)
router.post('/upload-media',
  auth,
  authorize('admin', 'super-admin'),
  mediaUpload.array('files', 10), // Max 10 files at once
  uploadMediaFiles
);

// Get uploaded media files (admin only)
router.get('/uploaded-media',
  auth,
  authorize('admin', 'super-admin'),
  getUploadedMedia
);

module.exports = router;