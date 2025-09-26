const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const ManualSwitchLog = require('../models/ManualSwitchLog');
const DeviceStatusLog = require('../models/DeviceStatusLog');

// GET /api/logs/activities
router.get('/activities', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      deviceId,
      startDate,
      endDate,
      severity,
      resolved
    } = req.query;

    const query = {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    if (deviceId && deviceId !== 'all') {
      query.deviceId = deviceId;
    }
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { deviceName: { $regex: search, $options: 'i' } },
        { switchName: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await ActivityLog.find(query)
      .populate('deviceId', 'name location')
      .populate('userId', 'name')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments(query);

    const formattedLogs = logs.map(log => ({
      id: log._id,
      timestamp: log.timestamp,
      action: log.action,
      deviceId: log.deviceId?._id,
      deviceName: log.deviceName || log.deviceId?.name,
      switchId: log.switchId,
      switchName: log.switchName,
      userId: log.userId?._id,
      userName: log.userName || log.userId?.name,
      triggeredBy: log.triggeredBy,
      location: log.location || log.deviceId?.location,
      isManualOverride: log.isManualOverride,
      previousState: log.previousState,
      newState: log.newState,
      conflictResolution: log.conflictResolution,
      details: log.details,
      context: log.context
    }));

    res.json({
      logs: formattedLogs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// GET /api/logs/manual-switches
router.get('/manual-switches', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      deviceId,
      startDate,
      endDate
    } = req.query;

    const query = {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (deviceId && deviceId !== 'all') {
      query.deviceId = deviceId;
    }
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { deviceName: { $regex: search, $options: 'i' } },
        { switchName: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await ManualSwitchLog.find(query)
      .populate('deviceId', 'name location')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ManualSwitchLog.countDocuments(query);

    const formattedLogs = logs.map(log => ({
      id: log._id,
      timestamp: log.timestamp,
      deviceId: log.deviceId?._id,
      deviceName: log.deviceName || log.deviceId?.name,
      switchId: log.switchId,
      switchName: log.switchName,
      action: log.action,
      previousState: log.previousState,
      newState: log.newState,
      conflictWith: log.conflictWith,
      responseTime: log.responseTime,
      location: log.location || log.deviceId?.location,
      details: log.context
    }));

    res.json({
      logs: formattedLogs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching manual switch logs:', error);
    res.status(500).json({ error: 'Failed to fetch manual switch logs' });
  }
});

// GET /api/logs/device-status
router.get('/device-status', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      deviceId,
      startDate,
      endDate
    } = req.query;

    const query = {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (deviceId && deviceId !== 'all') {
      query.deviceId = deviceId;
    }
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { deviceName: { $regex: search, $options: 'i' } },
        { deviceMac: { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await DeviceStatusLog.find(query)
      .populate('deviceId', 'name location macAddress')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DeviceStatusLog.countDocuments(query);

    const formattedLogs = logs.map(log => ({
      id: log._id,
      timestamp: log.timestamp,
      deviceId: log.deviceId?._id,
      deviceName: log.deviceName || log.deviceId?.name,
      deviceMac: log.deviceMac || log.deviceId?.macAddress,
      checkType: log.checkType,
      deviceStatus: log.deviceStatus,
      switchStates: log.switchStates,
      alerts: log.alerts,
      summary: log.summary,
      location: log.location || log.deviceId?.location
    }));

    res.json({
      logs: formattedLogs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching device status logs:', error);
    res.status(500).json({ error: 'Failed to fetch device status logs' });
  }
});

// GET /api/logs/stats
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Activity logs stats
    const activityTotal = await ActivityLog.countDocuments();
    const activityToday = await ActivityLog.countDocuments({
      timestamp: { $gte: today, $lt: tomorrow }
    });

    // Manual switch logs stats
    const manualTotal = await ManualSwitchLog.countDocuments();
    const manualToday = await ManualSwitchLog.countDocuments({
      timestamp: { $gte: today, $lt: tomorrow }
    });
    const manualConflicts = await ManualSwitchLog.countDocuments({
      'conflictWith.webCommand': true
    });

    // Device status logs stats
    const deviceTotal = await DeviceStatusLog.countDocuments();
    const deviceToday = await DeviceStatusLog.countDocuments({
      timestamp: { $gte: today, $lt: tomorrow }
    });

    res.json({
      activities: {
        total: activityTotal,
        today: activityToday
      },
      manualSwitches: {
        total: manualTotal,
        today: manualToday,
        conflicts: manualConflicts
      },
      deviceStatus: {
        total: deviceTotal,
        today: deviceToday
      }
    });
  } catch (error) {
    console.error('Error fetching log stats:', error);
    res.status(500).json({ error: 'Failed to fetch log stats' });
  }
});

module.exports = router;