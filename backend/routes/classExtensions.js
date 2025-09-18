const express = require('express');
const router = express.Router();
const { auth, authorize, requirePermission } = require('../middleware/auth');
const {
  createExtensionRequest,
  getMyExtensionRequests,
  getPendingApprovals,
  processExtensionRequest,
  getAllExtensionRequests,
  addComment,
  getExtensionStats
} = require('../controllers/classExtensionController');

// All routes require authentication
router.use(auth);

// Create a new extension request
router.post('/', requirePermission('canRequestExtensions'), createExtensionRequest);

// Get my extension requests
router.get('/my', getMyExtensionRequests);

// Get pending requests for approval
router.get('/pending', requirePermission('canApproveExtensions'), getPendingApprovals);

// Get all extension requests (admin only)
router.get('/', authorize('admin', 'super-admin'), getAllExtensionRequests);

// Process an extension request (approve/reject)
router.patch('/:id/process', requirePermission('canApproveExtensions'), processExtensionRequest);

// Add comment to extension request
router.post('/:id/comments', addComment);

// Get extension statistics
router.get('/stats/summary', authorize('admin', 'super-admin'), getExtensionStats);

module.exports = router;