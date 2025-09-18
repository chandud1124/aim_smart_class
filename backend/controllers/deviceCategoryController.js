const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const ManualSwitchLog = require('../models/ManualSwitchLog');
const DeviceStatusLog = require('../models/DeviceStatusLog');

// Get device categories with device lists
exports.getDeviceCategories = async (req, res) => {
  try {
    const { categoryBy = 'location', includeInactive = false, showAllDevices = true } = req.query;

    // Get all devices with populated data
    const devices = await Device.find({})
      .populate('assignedUsers', 'name email role')
      .sort({ name: 1 });

    // Categorize devices based on the requested category
    const categories = {};

    // Initialize categories based on categoryBy parameter
    devices.forEach(device => {
      let categoryKey = 'Uncategorized';
      let categoryName = 'Uncategorized';

      switch (categoryBy) {
        case 'location':
          categoryKey = device.location || 'No Location';
          categoryName = device.location || 'No Location';
          break;
        case 'classroom':
          categoryKey = device.classroom || 'No Classroom';
          categoryName = device.classroom || 'No Classroom';
          break;
        case 'status':
          categoryKey = device.status;
          categoryName = device.status.charAt(0).toUpperCase() + device.status.slice(1);
          break;
        case 'type':
          // Categorize by switch types
          const switchTypes = [...new Set(device.switches.map(sw => sw.type))];
          categoryKey = switchTypes.length > 0 ? switchTypes.join(', ') : 'No Switches';
          categoryName = switchTypes.length > 0 ? switchTypes.join(', ') : 'No Switches';
          break;
        default:
          categoryKey = device.location || 'No Location';
          categoryName = device.location || 'No Location';
      }

      if (!categories[categoryKey]) {
        categories[categoryKey] = {
          name: categoryName,
          key: categoryKey,
          deviceCount: 0,
          onlineCount: 0,
          offlineCount: 0,
          errorCount: 0,
          totalSwitches: 0,
          activeSwitches: 0,
          devices: []
        };
      }

      // Add device to category
      const deviceInfo = {
        id: device._id,
        name: device.name,
        macAddress: device.macAddress,
        ipAddress: device.ipAddress,
        location: device.location,
        classroom: device.classroom,
        status: device.status,
        lastSeen: device.lastSeen,
        switchCount: device.switches.length,
        activeSwitches: device.switches.filter(sw => sw.state).length,
        assignedUsers: device.assignedUsers.map(user => ({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        })),
        switches: device.switches.map(sw => ({
          id: sw._id,
          name: sw.name,
          gpio: sw.gpio,
          type: sw.type,
          state: sw.state,
          icon: sw.icon,
          manualSwitchEnabled: sw.manualSwitchEnabled,
          manualSwitchGpio: sw.manualSwitchGpio
        }))
      };

      categories[categoryKey].devices.push(deviceInfo);
      categories[categoryKey].deviceCount++;
      categories[categoryKey].totalSwitches += device.switches.length;
      categories[categoryKey].activeSwitches += device.switches.filter(sw => sw.state).length;

      // Count by status
      switch (device.status) {
        case 'online':
          categories[categoryKey].onlineCount++;
          break;
        case 'offline':
          categories[categoryKey].offlineCount++;
          break;
        case 'error':
          categories[categoryKey].errorCount++;
          break;
      }
    });

    // Convert to array and sort
    const categoryArray = Object.values(categories).sort((a, b) => {
      // Sort by device count descending, then by name
      if (b.deviceCount !== a.deviceCount) {
        return b.deviceCount - a.deviceCount;
      }
      return a.name.localeCompare(b.name);
    });

    // Calculate totals
    const totals = {
      totalCategories: categoryArray.length,
      totalDevices: devices.length,
      totalOnline: devices.filter(d => d.status === 'online').length,
      totalOffline: devices.filter(d => d.status === 'offline').length,
      totalError: devices.filter(d => d.status === 'error').length,
      totalSwitches: devices.reduce((sum, d) => sum + d.switches.length, 0),
      totalActiveSwitches: devices.reduce((sum, d) => sum + d.switches.filter(sw => sw.state).length, 0)
    };

    res.json({
      success: true,
      categoryBy,
      totals,
      categories: categoryArray,
      allDevices: showAllDevices ? devices.map(device => ({
        id: device._id,
        name: device.name,
        macAddress: device.macAddress,
        ipAddress: device.ipAddress,
        location: device.location,
        classroom: device.classroom,
        status: device.status,
        lastSeen: device.lastSeen,
        switchCount: device.switches.length,
        activeSwitches: device.switches.filter(sw => sw.state).length
      })) : []
    });

  } catch (error) {
    console.error('Error fetching device categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device categories',
      details: error.message
    });
  }
};

// Get detailed device information with recent activity
exports.getDeviceDetails = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { includeActivity = true, activityLimit = 10 } = req.query;

    // Get device with populated data
    const device = await Device.findById(deviceId)
      .populate('assignedUsers', 'name email role');

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const deviceDetails = {
      id: device._id,
      name: device.name,
      macAddress: device.macAddress,
      ipAddress: device.ipAddress,
      location: device.location,
      classroom: device.classroom,
      status: device.status,
      lastSeen: device.lastSeen,
      switches: device.switches.map(sw => ({
        id: sw._id,
        name: sw.name,
        gpio: sw.gpio,
        type: sw.type,
        state: sw.state,
        icon: sw.icon,
        manualSwitchEnabled: sw.manualSwitchEnabled,
        manualSwitchGpio: sw.manualSwitchGpio,
        manualMode: sw.manualMode,
        manualActiveLow: sw.manualActiveLow,
        usePir: sw.usePir,
        dontAutoOff: sw.dontAutoOff
      })),
      pirEnabled: device.pirEnabled,
      pirGpio: device.pirGpio,
      pirAutoOffDelay: device.pirAutoOffDelay,
      assignedUsers: device.assignedUsers.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      })),
      createdAt: device.createdAt,
      updatedAt: device.updatedAt
    };

    // Include recent activity if requested
    if (includeActivity) {
      const [activityLogs, manualSwitchLogs, statusLogs] = await Promise.all([
        ActivityLog.find({ deviceId })
          .populate('userId', 'name role')
          .sort({ timestamp: -1 })
          .limit(activityLimit),
        ManualSwitchLog.find({ deviceId })
          .sort({ timestamp: -1 })
          .limit(activityLimit),
        DeviceStatusLog.find({ deviceId })
          .sort({ timestamp: -1 })
          .limit(activityLimit)
      ]);

      deviceDetails.recentActivity = {
        activities: activityLogs.map(log => ({
          id: log._id,
          timestamp: log.timestamp,
          action: log.action,
          triggeredBy: log.triggeredBy,
          userName: log.userId?.name || 'System',
          switchName: log.switchName,
          details: log.context
        })),
        manualSwitches: manualSwitchLogs.map(log => ({
          id: log._id,
          timestamp: log.timestamp,
          action: log.action,
          switchName: log.switchName,
          previousState: log.previousState,
          newState: log.newState,
          detectedBy: log.detectedBy
        })),
        statusChecks: statusLogs.map(log => ({
          id: log._id,
          timestamp: log.timestamp,
          checkType: log.checkType,
          isOnline: log.deviceStatus?.isOnline,
          responseTime: log.deviceStatus?.responseTime,
          inconsistenciesFound: log.summary?.inconsistenciesFound || 0
        }))
      };
    }

    res.json({
      success: true,
      device: deviceDetails
    });

  } catch (error) {
    console.error('Error fetching device details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device details',
      details: error.message
    });
  }
};

// Get device activity summary for categories
exports.getDeviceActivitySummary = async (req, res) => {
  try {
    const { categoryBy = 'location', hours = 24 } = req.query;
    const since = new Date(Date.now() - (hours * 60 * 60 * 1000));

    // Get all devices
    const devices = await Device.find({}).sort({ name: 1 });

    // Get activity counts for each device
    const deviceIds = devices.map(d => d._id);
    const [activityCounts, manualSwitchCounts, errorCounts] = await Promise.all([
      ActivityLog.aggregate([
        { $match: { deviceId: { $in: deviceIds }, timestamp: { $gte: since } } },
        { $group: { _id: '$deviceId', count: { $sum: 1 } } }
      ]),
      ManualSwitchLog.aggregate([
        { $match: { deviceId: { $in: deviceIds }, timestamp: { $gte: since } } },
        { $group: { _id: '$deviceId', count: { $sum: 1 } } }
      ]),
      DeviceStatusLog.aggregate([
        { $match: { deviceId: { $in: deviceIds }, timestamp: { $gte: since }, 'summary.inconsistenciesFound': { $gt: 0 } } },
        { $group: { _id: '$deviceId', count: { $sum: 1 } } }
      ])
    ]);

    // Create activity map
    const activityMap = new Map();
    const manualSwitchMap = new Map();
    const errorMap = new Map();

    activityCounts.forEach(item => activityMap.set(item._id.toString(), item.count));
    manualSwitchCounts.forEach(item => manualSwitchMap.set(item._id.toString(), item.count));
    errorCounts.forEach(item => errorMap.set(item._id.toString(), item.count));

    // Group by category
    const categories = {};

    devices.forEach(device => {
      let categoryKey = 'Uncategorized';

      switch (categoryBy) {
        case 'location':
          categoryKey = device.location || 'No Location';
          break;
        case 'classroom':
          categoryKey = device.classroom || 'No Classroom';
          break;
        case 'status':
          categoryKey = device.status;
          break;
        default:
          categoryKey = device.location || 'No Location';
      }

      if (!categories[categoryKey]) {
        categories[categoryKey] = {
          name: categoryKey,
          deviceCount: 0,
          totalActivities: 0,
          totalManualSwitches: 0,
          totalErrors: 0,
          devices: []
        };
      }

      const deviceId = device._id.toString();
      const deviceActivity = {
        id: device._id,
        name: device.name,
        status: device.status,
        activities: activityMap.get(deviceId) || 0,
        manualSwitches: manualSwitchMap.get(deviceId) || 0,
        errors: errorMap.get(deviceId) || 0,
        lastActivity: null
      };

      categories[categoryKey].devices.push(deviceActivity);
      categories[categoryKey].deviceCount++;
      categories[categoryKey].totalActivities += deviceActivity.activities;
      categories[categoryKey].totalManualSwitches += deviceActivity.manualSwitches;
      categories[categoryKey].totalErrors += deviceActivity.errors;
    });

    // Convert to array and sort
    const categoryArray = Object.values(categories).sort((a, b) => {
      return b.totalActivities - a.totalActivities;
    });

    res.json({
      success: true,
      categoryBy,
      hours,
      categories: categoryArray
    });

  } catch (error) {
    console.error('Error fetching device activity summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device activity summary',
      details: error.message
    });
  }
};