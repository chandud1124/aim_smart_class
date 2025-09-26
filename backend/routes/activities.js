
const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get activity logs
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, deviceId, userId, classroom, startDate, endDate } = req.query;
    
    let query = {};
    
    // Apply filters
    if (deviceId) query.deviceId = deviceId;
    if (userId) query.userId = userId;
    if (classroom) query.classroom = new RegExp(classroom, 'i');
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    // Non-admin users can only see their assigned devices
    if (req.user.role !== 'admin') {
      query.deviceId = { $in: req.user.assignedDevices };
    }

    const activities = await ActivityLog.find(query)
      .populate('deviceId', 'name location classroom')
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ActivityLog.countDocuments(query);

    res.json({
      success: true,
      data: activities,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
