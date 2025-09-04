const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');

// GET /api/activity-logs
router.get('/', activityLogController.getLogs);

module.exports = router;
