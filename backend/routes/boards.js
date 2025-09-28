const express = require('express');
const router = express.Router();
const {
  createBoard,
  getBoards,
  getBoard,
  updateBoard,
  deleteBoard,
  getBoardContent,
  updateBoardContent,
  getBoardStats
} = require('../controllers/boardController');
const {
  createBoardGroup,
  getBoardGroups,
  getBoardGroup,
  updateBoardGroup,
  deleteBoardGroup,
  addBoardToGroup,
  removeBoardFromGroup,
  updateGroupSharedContent
} = require('../controllers/boardGroupController');
const { auth, authorize } = require('../middleware/auth');
const {
  validateBoardCreation,
  validateBoardUpdate,
  validateBoardGroupCreation,
  validateBoardGroupUpdate,
  validateContentAssignment,
  validateSharedContentUpdate
} = require('../middleware/boardValidation');
const { param, query } = require('express-validator');

// Board routes
router.post('/',
  auth,
  authorize('admin', 'super-admin'),
  validateBoardCreation,
  createBoard
);

// Board Group routes
router.post('/groups',
  auth,
  authorize('admin', 'super-admin'),
  validateBoardGroupCreation,
  createBoardGroup
);

router.get('/groups',
  auth,
  [
    query('type').optional().isIn(['department', 'location', 'building', 'custom']).withMessage('Invalid type'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
  ],
  getBoardGroups
);

router.get('/groups/:id',
  auth,
  param('id').isMongoId().withMessage('Invalid group ID'),
  getBoardGroup
);

router.patch('/groups/:id',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid group ID'),
  validateBoardGroupUpdate,
  updateBoardGroup
);

router.delete('/groups/:id',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid group ID'),
  deleteBoardGroup
);

// Board-Group management
router.post('/groups/:groupId/boards/:boardId',
  auth,
  authorize('admin', 'super-admin'),
  [
    param('groupId').isMongoId().withMessage('Invalid group ID'),
    param('boardId').isMongoId().withMessage('Invalid board ID')
  ],
  addBoardToGroup
);

router.delete('/groups/:groupId/boards/:boardId',
  auth,
  authorize('admin', 'super-admin'),
  [
    param('groupId').isMongoId().withMessage('Invalid group ID'),
    param('boardId').isMongoId().withMessage('Invalid board ID')
  ],
  removeBoardFromGroup
);

// Group shared content
router.patch('/groups/:id/shared-content',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid group ID'),
  validateSharedContentUpdate,
  updateGroupSharedContent
);

router.get('/',
  auth,
  [
    query('status').optional().isIn(['active', 'inactive', 'maintenance']).withMessage('Invalid status'),
    query('location').optional().trim(),
    query('type').optional().isIn(['digital', 'physical', 'projector', 'tv', 'monitor']).withMessage('Invalid type'),
    query('groupId').optional().isMongoId().withMessage('Invalid group ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('includeInactive').optional().isBoolean().withMessage('includeInactive must be a boolean')
  ],
  getBoards
);

router.get('/:id',
  auth,
  param('id').isMongoId().withMessage('Invalid board ID'),
  getBoard
);

router.patch('/:id',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid board ID'),
  validateBoardUpdate,
  updateBoard
);

router.delete('/:id',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid board ID'),
  deleteBoard
);

// Board content management
router.get('/:id/content',
  auth,
  param('id').isMongoId().withMessage('Invalid board ID'),
  getBoardContent
);

router.patch('/:id/content',
  auth,
  authorize('admin', 'super-admin'),
  param('id').isMongoId().withMessage('Invalid board ID'),
  validateContentAssignment,
  updateBoardContent
);

// Board statistics
router.get('/:id/stats',
  auth,
  param('id').isMongoId().withMessage('Invalid board ID'),
  getBoardStats
);

// Active boards (legacy route for compatibility)
router.get('/active/list',
  auth,
  getBoards
);

module.exports = router;