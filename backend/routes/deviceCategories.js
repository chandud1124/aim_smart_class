const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const deviceCategoryController = require('../controllers/deviceCategoryController');

// All routes require authentication
router.use(auth);

// Get device categories with device lists
router.get('/categories', deviceCategoryController.getDeviceCategories);

// Get detailed device information with recent activity
router.get('/device/:deviceId/details', deviceCategoryController.getDeviceDetails);

// Get device activity summary by categories
router.get('/activity-summary', deviceCategoryController.getDeviceActivitySummary);

// Get device categories filtered by specific criteria
router.get('/categories/filter', async (req, res) => {
  try {
    const { status, location, classroom, hasErrors } = req.query;

    // Build filter query
    const filter = {};
    if (status) filter.status = status;
    if (location) filter.location = new RegExp(location, 'i');
    if (classroom) filter.classroom = new RegExp(classroom, 'i');

    const Device = require('../models/Device');
    const devices = await Device.find(filter)
      .populate('assignedUsers', 'name email role')
      .sort({ name: 1 });

    // Group by location for filtered results
    const categories = {};
    devices.forEach(device => {
      const categoryKey = device.location || 'No Location';
      if (!categories[categoryKey]) {
        categories[categoryKey] = {
          name: categoryKey,
          deviceCount: 0,
          devices: []
        };
      }

      categories[categoryKey].devices.push({
        id: device._id,
        name: device.name,
        status: device.status,
        classroom: device.classroom,
        lastSeen: device.lastSeen,
        switchCount: device.switches.length
      });
      categories[categoryKey].deviceCount++;
    });

    res.json({
      success: true,
      filter: { status, location, classroom, hasErrors },
      categories: Object.values(categories)
    });

  } catch (error) {
    console.error('Error fetching filtered device categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filtered device categories'
    });
  }
});

// Get device statistics overview
router.get('/stats', authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const Device = require('../models/Device');
    const ActivityLog = require('../models/ActivityLog');

    const [deviceStats, recentActivity] = await Promise.all([
      Device.aggregate([
        {
          $group: {
            _id: null,
            totalDevices: { $sum: 1 },
            onlineDevices: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } },
            offlineDevices: { $sum: { $cond: [{ $eq: ['$status', 'offline'] }, 1, 0] } },
            errorDevices: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
            totalSwitches: { $sum: { $size: '$switches' } },
            activeSwitches: { $sum: { $size: { $filter: { input: '$switches', cond: '$$this.state' } } } }
          }
        }
      ]),
      ActivityLog.find({})
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('deviceId', 'name location')
        .populate('userId', 'name')
    ]);

    const stats = deviceStats[0] || {
      totalDevices: 0,
      onlineDevices: 0,
      offlineDevices: 0,
      errorDevices: 0,
      totalSwitches: 0,
      activeSwitches: 0
    };

    res.json({
      success: true,
      stats,
      recentActivity: recentActivity.map(activity => ({
        id: activity._id,
        timestamp: activity.timestamp,
        action: activity.action,
        deviceName: activity.deviceId?.name || 'Unknown Device',
        userName: activity.userId?.name || 'System',
        location: activity.deviceId?.location || 'Unknown'
      }))
    });

  } catch (error) {
    console.error('Error fetching device stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device statistics'
    });
  }
});

module.exports = router;