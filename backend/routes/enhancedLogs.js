const express = require('express');
const router = express.Router();
const { auth, checkDeviceAccess } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');
const ErrorLog = require('../models/ErrorLog');
const ManualSwitchLog = require('../models/ManualSwitchLog');
const DeviceStatusLog = require('../models/DeviceStatusLog');
const EnhancedLoggingService = require('../services/enhancedLoggingService');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;

// Get activity logs with filtering
router.get('/activities', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      deviceId,
      switchId,
      action,
      triggeredBy,
      userId,
      classroom,
      startDate,
      endDate,
      search
    } = req.query;

    const query = {};
    
    // Apply filters
    if (deviceId) query.deviceId = deviceId;
    if (switchId) query.switchId = switchId;
    if (action) query.action = action;
    if (triggeredBy) query.triggeredBy = triggeredBy;
    if (userId) query.userId = userId;
    if (classroom) query.classroom = new RegExp(classroom, 'i');
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { deviceName: new RegExp(search, 'i') },
        { switchName: new RegExp(search, 'i') },
        { userName: new RegExp(search, 'i') },
        { classroom: new RegExp(search, 'i') }
      ];
    }

    const totalCount = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .populate('deviceId', 'name classroom location')
      .populate('userId', 'username role')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('[ACTIVITY-LOGS-ERROR]', error);
    await EnhancedLoggingService.logError({
      errorType: 'api_error',
      severity: 'medium',
      message: 'Failed to fetch activity logs',
      details: { error: error.message },
      userId: req.user?.id,
      endpoint: req.originalUrl
    });
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Get error logs with filtering
router.get('/errors', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      errorType,
      severity,
      resolved,
      deviceId,
      userId,
      startDate,
      endDate,
      search
    } = req.query;

    const query = {};
    
    // Apply filters
    if (errorType) query.errorType = errorType;
    if (severity) query.severity = severity;
    if (resolved !== undefined) query.resolved = resolved === 'true';
    if (deviceId) query.deviceId = deviceId;
    if (userId) query.userId = userId;
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { message: new RegExp(search, 'i') },
        { deviceName: new RegExp(search, 'i') },
        { userName: new RegExp(search, 'i') },
        { endpoint: new RegExp(search, 'i') }
      ];
    }

    const totalCount = await ErrorLog.countDocuments(query);
    const logs = await ErrorLog.find(query)
      .populate('deviceId', 'name classroom location')
      .populate('userId', 'username role')
      .populate('resolvedBy', 'username')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('[ERROR-LOGS-ERROR]', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

// Get manual switch logs
router.get('/manual-switches', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      deviceId,
      switchId,
      action,
      hasConflict,
      startDate,
      endDate
    } = req.query;

    const query = {};
    
    if (deviceId) query.deviceId = deviceId;
    if (switchId) query.switchId = switchId;
    if (action) query.action = action;
    if (hasConflict === 'true') {
      query.$or = [
        { 'conflictWith.webCommand': true },
        { 'conflictWith.scheduleCommand': true },
        { 'conflictWith.pirCommand': true }
      ];
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const totalCount = await ManualSwitchLog.countDocuments(query);
    const logs = await ManualSwitchLog.find(query)
      .populate('deviceId', 'name classroom location')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('[MANUAL-SWITCH-LOGS-ERROR]', error);
    res.status(500).json({ error: 'Failed to fetch manual switch logs' });
  }
});

// Get device status logs (monitoring logs)
router.get('/device-status', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      deviceId,
      checkType,
      hasInconsistencies,
      startDate,
      endDate
    } = req.query;

    const query = {};
    
    if (deviceId) query.deviceId = deviceId;
    if (checkType) query.checkType = checkType;
    if (hasInconsistencies === 'true') {
      query['summary.inconsistenciesFound'] = { $gt: 0 };
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const totalCount = await DeviceStatusLog.countDocuments(query);
    const logs = await DeviceStatusLog.find(query)
      .populate('deviceId', 'name classroom location')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('[STATUS-LOGS-ERROR]', error);
    res.status(500).json({ error: 'Failed to fetch device status logs' });
  }
});

// Export logs to Excel
router.post('/export/excel', auth, async (req, res) => {
  try {
    const { logType, filters = {}, includeColumns = [] } = req.body;
    
    let Model;
    let defaultColumns = [];
    
    switch (logType) {
      case 'activities':
        Model = ActivityLog;
        defaultColumns = ['timestamp', 'deviceName', 'switchName', 'action', 'triggeredBy', 'userName', 'classroom'];
        break;
      case 'errors':
        Model = ErrorLog;
        defaultColumns = ['timestamp', 'errorType', 'severity', 'message', 'deviceName', 'userName', 'resolved'];
        break;
      case 'manual-switches':
        Model = ManualSwitchLog;
        defaultColumns = ['timestamp', 'deviceName', 'switchName', 'action', 'previousState', 'newState', 'detectedBy'];
        break;
      case 'device-status':
        Model = DeviceStatusLog;
        defaultColumns = ['timestamp', 'deviceName', 'checkType', 'totalSwitchesOn', 'totalSwitchesOff', 'inconsistenciesFound'];
        break;
      default:
        return res.status(400).json({ error: 'Invalid log type' });
    }
    
    const columns = includeColumns.length > 0 ? includeColumns : defaultColumns;
    
    // Apply filters (same logic as GET endpoints)
    const query = {};
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
      if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
    }
    
    // Add other filters based on log type
    Object.keys(filters).forEach(key => {
      if (key !== 'startDate' && key !== 'endDate' && filters[key]) {
        query[key] = filters[key];
      }
    });
    
    const logs = await Model.find(query)
      .populate('deviceId', 'name classroom location')
      .populate('userId', 'username role')
      .sort({ timestamp: -1 })
      .limit(5000); // Limit to prevent memory issues
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${logType.charAt(0).toUpperCase() + logType.slice(1)} Logs`);
    
    // Add headers
    const headers = columns.map(col => ({
      header: col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, ' $1'),
      key: col,
      width: 20
    }));
    worksheet.columns = headers;
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data rows
    logs.forEach(log => {
      const row = {};
      columns.forEach(col => {
        let value = log[col];
        
        // Handle nested properties
        if (col.includes('.')) {
          const parts = col.split('.');
          value = parts.reduce((obj, part) => obj && obj[part], log);
        }
        
        // Handle special cases
        if (col === 'timestamp' && value) {
          value = new Date(value).toLocaleString();
        } else if (col === 'deviceName' && log.deviceId?.name) {
          value = log.deviceId.name;
        } else if (col === 'userName' && log.userId?.username) {
          value = log.userId.username;
        } else if (col === 'classroom' && (log.classroom || log.deviceId?.classroom)) {
          value = log.classroom || log.deviceId?.classroom;
        }
        
        row[col] = value || '';
      });
      worksheet.addRow(row);
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width, 15);
    });
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${logType}_logs_${timestamp}.xlsx`;
    const filepath = path.join(__dirname, '../exports', filename);
    
    // Ensure exports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    // Write file
    await workbook.xlsx.writeFile(filepath);
    
    // Send file
    res.download(filepath, filename, async (err) => {
      if (err) {
        console.error('[DOWNLOAD-ERROR]', err);
        await EnhancedLoggingService.logError({
          errorType: 'system_error',
          severity: 'medium',
          message: 'Failed to download exported file',
          details: { filename, error: err.message },
          userId: req.user?.id
        });
      }
      
      // Clean up file after download
      try {
        await fs.unlink(filepath);
      } catch (cleanupErr) {
        console.error('[CLEANUP-ERROR]', cleanupErr);
      }
    });
    
    // Log export activity
    await EnhancedLoggingService.logActivity({
      action: 'export',
      triggeredBy: 'user',
      userId: req.user.id,
      userName: req.user.username,
      context: {
        exportType: 'excel',
        logType,
        recordCount: logs.length,
        filename
      }
    });
    
  } catch (error) {
    console.error('[EXPORT-ERROR]', error);
    await EnhancedLoggingService.logError({
      errorType: 'system_error',
      severity: 'medium',
      message: 'Failed to export logs to Excel',
      details: { error: error.message },
      userId: req.user?.id,
      endpoint: req.originalUrl
    });
    res.status(500).json({ error: 'Failed to export logs' });
  }
});

// Mark error as resolved
router.patch('/errors/:id/resolve', auth, async (req, res) => {
  try {
    const { notes } = req.body;
    
    const errorLog = await ErrorLog.findByIdAndUpdate(
      req.params.id,
      {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user.id,
        notes: notes || ''
      },
      { new: true }
    ).populate('resolvedBy', 'username');
    
    if (!errorLog) {
      return res.status(404).json({ error: 'Error log not found' });
    }
    
    // Log the resolution
    await EnhancedLoggingService.logActivity({
      action: 'error_resolved',
      triggeredBy: 'user',
      userId: req.user.id,
      userName: req.user.username,
      context: {
        errorLogId: errorLog._id,
        errorType: errorLog.errorType,
        severity: errorLog.severity,
        notes
      }
    });
    
    res.json({ errorLog });
  } catch (error) {
    console.error('[RESOLVE-ERROR]', error);
    res.status(500).json({ error: 'Failed to resolve error' });
  }
});

// Get log statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const stats = await EnhancedLoggingService.getLogStats(timeframe);
    res.json(stats);
  } catch (error) {
    console.error('[STATS-ERROR]', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;
