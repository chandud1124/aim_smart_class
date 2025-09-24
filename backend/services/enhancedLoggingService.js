const ActivityLog = require('../models/ActivityLog');
const ErrorLog = require('../models/ErrorLog');
const ManualSwitchLog = require('../models/ManualSwitchLog');
const DeviceStatusLog = require('../models/DeviceStatusLog');
const PowerConsumptionLog = require('../models/PowerConsumptionLog');

class EnhancedLoggingService {
  
  // Activity logging (enhanced)
  static async logActivity(data) {
    try {
      const activity = new ActivityLog({
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        switchId: data.switchId,
        switchName: data.switchName,
        action: data.action,
        triggeredBy: data.triggeredBy,
        userId: data.userId,
        userName: data.userName,
        classroom: data.classroom,
        location: data.location,
        ip: data.ip,
        userAgent: data.userAgent,
        duration: data.duration,
        powerConsumption: data.powerConsumption,
        conflictResolution: data.conflictResolution,
        deviceStatus: data.deviceStatus,
        context: data.context || {}
      });
      
      await activity.save();
      console.log(`[ACTIVITY] ${data.action} - ${data.deviceName} - ${data.switchName}`);
      return activity;
    } catch (error) {
      console.error('[ACTIVITY-LOG-ERROR]', error);
      // Don't throw to prevent logging errors from crashing operations
    }
  }

  // Manual switch logging
  static async logManualSwitch(data) {
    try {
      const manualLog = new ManualSwitchLog({
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        deviceMac: data.deviceMac,
        switchId: data.switchId,
        switchName: data.switchName,
        physicalPin: data.physicalPin,
        action: data.action,
        previousState: data.previousState,
        newState: data.newState,
        conflictWith: data.conflictWith || {},
        detectedBy: data.detectedBy || 'gpio_interrupt',
        responseTime: data.responseTime || 0,
        classroom: data.classroom,
        location: data.location,
        context: data.context || {}
      });
      
      await manualLog.save();
      
      // Also log in regular activity log
      await this.logActivity({
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        switchId: data.switchId,
        switchName: data.switchName,
        action: data.action,
        triggeredBy: 'manual_switch',
        classroom: data.classroom,
        location: data.location,
        conflictResolution: {
          hasConflict: data.conflictWith ? 
            (data.conflictWith.webCommand || data.conflictWith.scheduleCommand || data.conflictWith.pirCommand) : false,
          conflictType: this.getConflictType(data.conflictWith),
          resolution: 'manual_override',
          responseTime: data.responseTime
        },
        context: {
          manualSwitch: true,
          detectedBy: data.detectedBy,
          ...data.context
        }
      });
      
      console.log(`[MANUAL-SWITCH] ${data.deviceName} - ${data.switchName} - ${data.action}`);
      return manualLog;
    } catch (error) {
      console.error('[MANUAL-SWITCH-LOG-ERROR]', error);
      await this.logError({
        errorType: 'system_error',
        severity: 'medium',
        message: 'Failed to log manual switch operation',
        details: { originalData: data, error: error.message }
      });
    }
  }

  // Error logging
  static async logError(data) {
    try {
      const errorLog = new ErrorLog({
        errorType: data.errorType,
        severity: data.severity || 'medium',
        message: data.message,
        details: data.details || {},
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        deviceMac: data.deviceMac,
        userId: data.userId,
        userName: data.userName,
        userRole: data.userRole,
        ip: data.ip,
        userAgent: data.userAgent,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        stackTrace: data.stackTrace,
        context: data.context || {}
      });
      
      await errorLog.save();
      
      // Console logging with color coding
      const colors = {
        low: '\x1b[32m',      // green
        medium: '\x1b[33m',   // yellow
        high: '\x1b[31m',     // red
        critical: '\x1b[41m'  // red background
      };
      const resetColor = '\x1b[0m';
      const color = colors[data.severity] || colors.medium;
      
      console.log(`${color}[ERROR-${data.severity.toUpperCase()}] ${data.errorType}: ${data.message}${resetColor}`);
      
      return errorLog;
    } catch (error) {
      console.error('[ERROR-LOG-ERROR]', error);
      // Fallback to console logging if database fails
      console.error(`[FALLBACK-ERROR] ${data.errorType}: ${data.message}`);
    }
  }

  // Device status logging (every 5 minutes)
  static async logDeviceStatus(data) {
    try {
      // Ensure alerts is properly formatted as an array of objects
      let processedAlerts = [];
      
      if (data.alerts && Array.isArray(data.alerts)) {
        processedAlerts = data.alerts
          .filter(alert => alert && typeof alert === 'object' && !Array.isArray(alert))
          .map(alert => ({
            type: String(alert.type || 'unknown'),
            message: String(alert.message || 'No message'),
            severity: String(alert.severity || 'medium'),
            timestamp: alert.timestamp instanceof Date ? alert.timestamp : new Date(alert.timestamp || Date.now())
          }));
      }

      const statusLog = new DeviceStatusLog({
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        deviceMac: data.deviceMac,
        checkType: data.checkType || 'scheduled_check',
        switchStates: data.switchStates || [],
        deviceStatus: data.deviceStatus || {},
        networkInfo: data.networkInfo || {},
        alerts: processedAlerts,
        summary: data.summary || {},
        classroom: data.classroom,
        location: data.location,
        nextCheckDue: new Date(Date.now() + (5 * 60 * 1000)) // 5 minutes from now
      });
      
      await statusLog.save();
      
      // Log in activity if there are inconsistencies
      if (data.summary?.inconsistenciesFound > 0) {
        await this.logActivity({
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          action: 'status_check',
          triggeredBy: 'monitoring',
          classroom: data.classroom,
          location: data.location,
          context: {
            inconsistenciesFound: data.summary.inconsistenciesFound,
            checkType: data.checkType,
            alerts: data.alerts
          }
        });
      }
      
      console.log(`[STATUS-CHECK] ${data.deviceName} - ${data.summary?.totalSwitchesOn || 0} switches on`);
      return statusLog;
    } catch (error) {
      console.error('[STATUS-LOG-ERROR]', error);
      await this.logError({
        errorType: 'system_error',
        severity: 'medium',
        message: 'Failed to log device status',
        details: { deviceId: data.deviceId, error: error.message }
      });
    }
  }

  // Helper method to determine conflict type
  static getConflictType(conflictWith) {
    if (!conflictWith) return null;
    
    if (conflictWith.webCommand) return 'web_command_conflict';
    if (conflictWith.scheduleCommand) return 'schedule_conflict';
    if (conflictWith.pirCommand) return 'pir_conflict';
    
    return null;
  }

  // Authentication error helper
  static async logAuthError(req, errorType, message, details = {}) {
    return await this.logError({
      errorType: errorType,
      severity: 'medium',
      message: message,
      details: details,
      userId: req.user?.id,
      userName: req.user?.username,
      userRole: req.user?.role,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      context: {
        timestamp: new Date().toISOString(),
        session: req.session?.id
      }
    });
  }

  // Device connection error helper
  static async logDeviceError(device, errorType, message, details = {}) {
    return await this.logError({
      errorType: errorType,
      severity: errorType.includes('connection') ? 'high' : 'medium',
      message: message,
      details: details,
      deviceId: device._id,
      deviceName: device.name,
      deviceMac: device.mac,
      context: {
        location: device.location,
        classroom: device.classroom,
        lastSeen: device.lastSeen,
        isOnline: device.isOnline
      }
    });
  }

  // ESP32 error helper (for WebSocket errors)
  static async logESP32Error(socketData, errorType, message, details = {}) {
    return await this.logError({
      errorType: errorType,
      severity: 'high',
      message: message,
      details: details,
      deviceMac: socketData.mac,
      deviceName: socketData.deviceName,
      context: {
        socketId: socketData.socketId,
        ipAddress: socketData.ipAddress,
        uptime: socketData.uptime,
        freeHeap: socketData.freeHeap
      }
    });
  }

  // Clean up old logs (to be called periodically)
  static async cleanupLogs() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
      const ninetyDaysAgo = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));
      
      // Keep activity logs for 30 days
      await ActivityLog.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });
      
      // Keep manual switch logs for 90 days
      await ManualSwitchLog.deleteMany({ timestamp: { $lt: ninetyDaysAgo } });
      
      // Keep status logs for 30 days
      await DeviceStatusLog.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });
      
      // Keep error logs for 90 days, but keep critical errors for 1 year
      const oneYearAgo = new Date(Date.now() - (365 * 24 * 60 * 60 * 1000));
      await ErrorLog.deleteMany({ 
        timestamp: { $lt: ninetyDaysAgo },
        severity: { $ne: 'critical' }
      });
      await ErrorLog.deleteMany({ 
        timestamp: { $lt: oneYearAgo },
        severity: 'critical'
      });
      
      console.log('[CLEANUP] Old logs cleaned up successfully');
    } catch (error) {
      console.error('[CLEANUP-ERROR]', error);
    }
  }

  // Get log statistics
  static async getLogStats(timeframe = '24h') {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const since = new Date();
      switch (timeframe) {
        case '1h': since.setHours(since.getHours() - 1); break;
        case '24h': since.setDate(since.getDate() - 1); break;
        case '7d': since.setDate(since.getDate() - 7); break;
        case '30d': since.setDate(since.getDate() - 30); break;
        default: since.setDate(since.getDate() - 1);
      }
      
      // Get total counts and today's counts
      const [
        totalActivities,
        todayActivities,
        totalErrors,
        todayErrors,
        unresolvedErrors,
        totalManualSwitches,
        todayManualSwitches,
        conflictSwitches,
        totalDeviceStatus,
        todayDeviceStatus
      ] = await Promise.all([
        ActivityLog.countDocuments({}),
        ActivityLog.countDocuments({ timestamp: { $gte: today, $lt: tomorrow } }),
        ErrorLog.countDocuments({}),
        ErrorLog.countDocuments({ timestamp: { $gte: today, $lt: tomorrow } }),
        ErrorLog.countDocuments({ isResolved: false }),
        ManualSwitchLog.countDocuments({}),
        ManualSwitchLog.countDocuments({ timestamp: { $gte: today, $lt: tomorrow } }),
        ManualSwitchLog.countDocuments({ hasConflict: true }),
        DeviceStatusLog.countDocuments({}),
        DeviceStatusLog.countDocuments({ timestamp: { $gte: today, $lt: tomorrow } })
      ]);
      
      return {
        activities: { 
          total: totalActivities, 
          today: todayActivities 
        },
        errors: { 
          total: totalErrors, 
          today: todayErrors, 
          unresolved: unresolvedErrors 
        },
        manualSwitches: { 
          total: totalManualSwitches, 
          today: todayManualSwitches, 
          conflicts: conflictSwitches 
        },
        deviceStatus: { 
          total: totalDeviceStatus, 
          today: todayDeviceStatus 
        }
      };
    } catch (error) {
      console.error('[STATS-ERROR]', error);
      return null;
    }
  }

  // Power consumption logging
  static async logPowerConsumption(data) {
    try {
      const powerLog = new PowerConsumptionLog({
        timestamp: data.timestamp || new Date(),
        totalConsumption: data.totalConsumption,
        byDevice: data.byDevice,
        byClassroom: data.byClassroom,
        byDeviceType: data.byDeviceType
      });

      await powerLog.save();
      console.log(`[POWER-CONSUMPTION] Logged ${data.totalConsumption}W total consumption`);
      return powerLog;
    } catch (error) {
      console.error('[POWER-CONSUMPTION-LOG-ERROR]', error);
      // Don't throw to prevent logging errors from crashing operations
    }
  }
}

module.exports = EnhancedLoggingService;
