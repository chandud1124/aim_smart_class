const ActivityLog = require('../models/ActivityLog');

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
