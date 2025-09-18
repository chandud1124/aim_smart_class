const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');

// GET /api/activity-logs
router.get('/', activityLogController.getLogs);

// GET /api/activity-logs/categorized - Get logs with device categorization
router.get('/categorized', activityLogController.getLogsWithCategories);

module.exports = router;
