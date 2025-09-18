const ActivityLog = require('../models/ActivityLog');
const Device = require('../models/Device');

// Create a new log entry
exports.createLog = async (logData) => {
  try {
    const log = new ActivityLog(logData);
    await log.save();
    return log;
  } catch (err) {
    console.error('Error creating activity log:', err);
    throw err;
  }
};

// Get logs (optionally filtered by device, user, classroom)
exports.getLogs = async (req, res) => {
  try {
    const { deviceId, userId, classroom, limit = 50 } = req.query;
    const query = {};
    if (deviceId) query.deviceId = deviceId;
    if (userId) query.userId = userId;
    if (classroom) query.classroom = classroom;
    const logs = await ActivityLog.find(query).sort({ timestamp: -1 }).limit(Number(limit));
    res.json(logs);
  } catch (err) {
    console.error('Error fetching activity logs:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

// Get logs with device categorization
exports.getLogsWithCategories = async (req, res) => {
  try {
    const {
      deviceId,
      userId,
      classroom,
      limit = 50,
      categoryBy = 'location',
      includeDeviceDetails = true
    } = req.query;

    const query = {};
    if (deviceId) query.deviceId = deviceId;
    if (userId) query.userId = userId;
    if (classroom) query.classroom = classroom;

    // Get logs with device population
    const logs = await ActivityLog.find(query)
      .populate('deviceId', 'name location classroom status switches')
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    // Group logs by device categories
    const categories = {};

    logs.forEach(log => {
      let categoryKey = 'Uncategorized';
      let categoryName = 'Uncategorized';

      if (log.deviceId) {
        switch (categoryBy) {
          case 'location':
            categoryKey = log.deviceId.location || 'No Location';
            categoryName = log.deviceId.location || 'No Location';
            break;
          case 'classroom':
            categoryKey = log.deviceId.classroom || 'No Classroom';
            categoryName = log.deviceId.classroom || 'No Classroom';
            break;
          case 'status':
            categoryKey = log.deviceId.status;
            categoryName = log.deviceId.status.charAt(0).toUpperCase() + log.deviceId.status.slice(1);
            break;
          case 'type':
            const switchTypes = [...new Set(log.deviceId.switches?.map(sw => sw.type) || [])];
            categoryKey = switchTypes.length > 0 ? switchTypes.join(', ') : 'No Switches';
            categoryName = switchTypes.length > 0 ? switchTypes.join(', ') : 'No Switches';
            break;
          default:
            categoryKey = log.deviceId.location || 'No Location';
            categoryName = log.deviceId.location || 'No Location';
        }
      }

      if (!categories[categoryKey]) {
        categories[categoryKey] = {
          name: categoryName,
          key: categoryKey,
          logCount: 0,
          devices: new Set(),
          activities: []
        };
      }

      // Add log to category
      const logEntry = {
        id: log._id,
        timestamp: log.timestamp,
        action: log.action,
        triggeredBy: log.triggeredBy,
        deviceId: log.deviceId?._id,
        deviceName: log.deviceName || log.deviceId?.name,
        switchId: log.switchId,
        switchName: log.switchName,
        userId: log.userId?._id,
        userName: log.userName || log.userId?.name || 'System',
        location: log.location || log.deviceId?.location,
        classroom: log.classroom || log.deviceId?.classroom,
        context: log.context
      };

      if (includeDeviceDetails && log.deviceId) {
        logEntry.deviceDetails = {
          status: log.deviceId.status,
          switchCount: log.deviceId.switches?.length || 0,
          activeSwitches: log.deviceId.switches?.filter(sw => sw.state).length || 0
        };
      }

      categories[categoryKey].activities.push(logEntry);
      categories[categoryKey].logCount++;
      if (log.deviceId) {
        categories[categoryKey].devices.add(log.deviceId._id.toString());
      }
    });

    // Convert to array and sort
    const categoryArray = Object.values(categories).map(cat => ({
      ...cat,
      deviceCount: cat.devices.size,
      devices: Array.from(cat.devices)
    })).sort((a, b) => {
      // Sort by log count descending, then by name
      if (b.logCount !== a.logCount) {
        return b.logCount - a.logCount;
      }
      return a.name.localeCompare(b.name);
    });

    // Calculate totals
    const totals = {
      totalCategories: categoryArray.length,
      totalLogs: logs.length,
      totalDevices: new Set(logs.map(log => log.deviceId?._id?.toString()).filter(Boolean)).size
    };

    res.json({
      success: true,
      categoryBy,
      totals,
      categories: categoryArray,
      allLogs: logs.map(log => ({
        id: log._id,
        timestamp: log.timestamp,
        action: log.action,
        triggeredBy: log.triggeredBy,
        deviceId: log.deviceId?._id,
        deviceName: log.deviceName || log.deviceId?.name,
        switchId: log.switchId,
        switchName: log.switchName,
        userId: log.userId?._id,
        userName: log.userName || log.userId?.name || 'System',
        location: log.location || log.deviceId?.location,
        classroom: log.classroom || log.deviceId?.classroom
      }))
    });

  } catch (err) {
    console.error('Error fetching categorized activity logs:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categorized logs',
      details: err.message
    });
  }
};
