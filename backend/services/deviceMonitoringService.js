const Device = require('../models/Device');
const PowerConsumptionLog = require('../models/PowerConsumptionLog');
const EnhancedLoggingService = require('./enhancedLoggingService');
const DeviceStatusLog = require('../models/DeviceStatusLog');

// Import power calculation functions from metricsService
const { getBasePowerConsumption, calculateDevicePowerConsumption } = require('../metricsService');

class DeviceMonitoringService {
  constructor() {
    this.monitoringInterval = null;
    this.isRunning = false;
    this.checkIntervalMs = 5 * 60 * 1000; // 5 minutes
  }

  // Start the monitoring service
  start() {
    if (this.isRunning) {
      console.log('[MONITORING] Service already running');
      return;
    }

    this.isRunning = true;
    console.log('[MONITORING] Starting device monitoring service (5-minute intervals)');
    
    // Run initial check
    this.performMonitoringCheck();
    
    // Set up recurring checks
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCheck();
    }, this.checkIntervalMs);
  }

  // Stop the monitoring service
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('[MONITORING] Device monitoring service stopped');
  }

  // Perform monitoring check for all devices
  async performMonitoringCheck() {
    try {
      console.log('[MONITORING] Starting scheduled device status check...');

      const devices = await Device.find({}).sort({ name: 1 });

      for (const device of devices) {
        await this.checkDeviceStatus(device);
        // Small delay between devices to prevent overwhelming
        await this.sleep(1000);
      }

      // Store power consumption data by device and classroom
      await this.storePowerConsumptionData(devices);

      console.log(`[MONITORING] Completed status check for ${devices.length} devices`);
    } catch (error) {
      console.error('[MONITORING-ERROR]', error);
      await EnhancedLoggingService.logError({
        errorType: 'system_error',
        severity: 'high',
        message: 'Device monitoring check failed',
        details: { error: error.message }
      });
    }
  }

  // Check individual device status
  async checkDeviceStatus(device) {
    try {
      const statusData = {
        deviceId: device._id,
        deviceName: device.name,
        deviceMac: device.mac,
        checkType: 'scheduled_check',
        classroom: device.classroom,
        location: device.location
      };

      // Get current switch states (this would come from ESP32 in real implementation)
      const switchStates = await this.getSwitchStates(device);
      statusData.switchStates = switchStates;

      // Get device status
      const deviceStatus = await this.getDeviceStatus(device);
      statusData.deviceStatus = deviceStatus;

      // Get network info
      const networkInfo = await this.getNetworkInfo(device);
      statusData.networkInfo = networkInfo;

      // Check for alerts
      const alerts = await this.checkForAlerts(device, deviceStatus, switchStates);
      statusData.alerts = alerts;

      // Generate summary
      const summary = this.generateSummary(switchStates, alerts);
      statusData.summary = summary;

      // Log the status
      await EnhancedLoggingService.logDeviceStatus(statusData);

      // Update device last checked timestamp
      await Device.findByIdAndUpdate(device._id, {
        lastStatusCheck: new Date(),
        isOnline: deviceStatus.isOnline
      });

    } catch (error) {
      console.error(`[MONITORING] Error checking device ${device.name}:`, error);
      await EnhancedLoggingService.logDeviceError(device, 'device_timeout', 
        `Failed to get status from device ${device.name}`, { error: error.message });
    }
  }

  // Get switch states from device (placeholder - would use WebSocket in real implementation)
  async getSwitchStates(device) {
    try {
      // In a real implementation, this would query the ESP32 via WebSocket
      // For now, we'll use the stored states from the device model
      
      const switchStates = [];
      
      // Use actual switches from device if available
      if (device.switches && Array.isArray(device.switches)) {
        for (const switchData of device.switches) {
          const currentState = switchData.state ? 'on' : 'off'; // Convert boolean to string
          const expectedState = currentState; // Would come from schedule/commands
          
          // Calculate duration (simulated)
          const currentSession = Math.floor(Math.random() * 120); // 0-120 minutes
          const totalToday = Math.floor(Math.random() * 480); // 0-8 hours
          const totalWeek = totalToday * 7 + Math.floor(Math.random() * 1000);
          
          // Calculate power consumption using improved function
          const basePower = getBasePowerConsumption(switchData.name, switchData.type);
          const currentPower = currentState === 'on' ? basePower : 0;
          const totalTodayPower = (totalToday / 60) * basePower;
          const totalWeekPower = (totalWeek / 60) * basePower;

          switchStates.push({
            switchId: switchData._id?.toString() || switchData.id,
            switchName: switchData.name,
            physicalPin: switchData.gpio,
            expectedState: expectedState,
            actualState: currentState,
            isMatch: expectedState === currentState,
            duration: {
              currentSession: currentSession,
              totalToday: totalToday,
              totalWeek: totalWeek
            },
            powerConsumption: {
              current: currentPower,
              totalToday: totalTodayPower,
              totalWeek: totalWeekPower
            },
            lastChanged: switchData.lastChanged || new Date(),
            changeReason: switchData.lastChangedBy || 'unknown'
          });
        }
      }

      return switchStates;
    } catch (error) {
      console.error(`[SWITCH-STATES] Error getting switch states for ${device.name}:`, error);
      return [];
    }
  }

  // Get device status (placeholder - would query ESP32)
  async getDeviceStatus(device) {
    try {
      const now = new Date();
      const timeSinceLastSeen = device.lastSeen ? now - device.lastSeen : Infinity;
      const isOnline = timeSinceLastSeen < (2 * 60 * 1000); // 2 minutes (consistent with server offline detection)

      return {
        isOnline: isOnline,
        wifiSignalStrength: Math.floor(Math.random() * 100), // -100 to 0 dBm
        uptime: Math.floor(Math.random() * 86400), // seconds
        freeHeap: Math.floor(Math.random() * 50000) + 10000, // bytes
        temperature: Math.floor(Math.random() * 20) + 20, // 20-40°C
        lastSeen: device.lastSeen || new Date(),
        responseTime: Math.floor(Math.random() * 500) + 50, // milliseconds
        powerStatus: isOnline ? 'stable' : 'unknown'
      };
    } catch (error) {
      return {
        isOnline: false,
        responseTime: -1,
        powerStatus: 'unknown'
      };
    }
  }

  // Get network information
  async getNetworkInfo(device) {
    return {
      ipAddress: device.ipAddress || '192.168.1.100',
      gateway: '192.168.1.1',
      subnet: '255.255.255.0',
      dns: '8.8.8.8',
      macAddress: device.mac
    };
  }

  // Check for alerts and issues
  async checkForAlerts(device, deviceStatus, switchStates) {
    const alerts = [];
    const now = new Date();

    // Check if device is offline
    if (!deviceStatus.isOnline) {
      alerts.push({
        type: 'device_offline',
        message: `Device ${device.name} is offline`,
        severity: 'high',
        timestamp: now
      });
    }

    // Check for high response time
    if (deviceStatus.responseTime > 2000) {
      alerts.push({
        type: 'high_latency',
        message: `High response time: ${deviceStatus.responseTime}ms`,
        severity: 'medium',
        timestamp: now
      });
    }

    // Check for low memory
    if (deviceStatus.freeHeap < 5000) {
      alerts.push({
        type: 'low_memory',
        message: `Low free heap: ${deviceStatus.freeHeap} bytes`,
        severity: 'high',
        timestamp: now
      });
    }

    // Check for temperature issues
    if (deviceStatus.temperature > 60) {
      alerts.push({
        type: 'overheating',
        message: `High temperature: ${deviceStatus.temperature}°C`,
        severity: 'critical',
        timestamp: now
      });
    }

    // Check for state inconsistencies
    const inconsistentSwitches = switchStates.filter(s => !s.isMatch);
    if (inconsistentSwitches.length > 0) {
      alerts.push({
        type: 'state_inconsistency',
        message: `${inconsistentSwitches.length} switches have inconsistent states`,
        severity: 'medium',
        timestamp: now
      });
    }

    // Check for excessive power consumption
    const totalPower = switchStates.reduce((sum, s) => sum + s.powerConsumption.current, 0);
    if (totalPower > 3000) { // 3kW threshold
      alerts.push({
        type: 'high_power_consumption',
        message: `High power consumption: ${totalPower}W`,
        severity: 'medium',
        timestamp: now
      });
    }

    return alerts;
  }

  // Generate summary statistics
  generateSummary(switchStates, alerts) {
    const totalSwitchesOn = switchStates.filter(s => s.actualState === 'on').length;
    const totalSwitchesOff = switchStates.filter(s => s.actualState === 'off').length;
    const totalPowerConsumption = switchStates.reduce((sum, s) => sum + s.powerConsumption.current, 0);
    const averageResponseTime = switchStates.length > 0 ? 
      switchStates.reduce((sum, s) => sum + (s.responseTime || 0), 0) / switchStates.length : 0;
    const inconsistenciesFound = switchStates.filter(s => !s.isMatch).length;

    return {
      totalSwitchesOn,
      totalSwitchesOff,
      totalPowerConsumption,
      averageResponseTime,
      inconsistenciesFound,
      alertsCount: alerts.length,
      criticalAlertsCount: alerts.filter(a => a.severity === 'critical').length
    };
  }

  // Store power consumption data by device and classroom
  async storePowerConsumptionData(devices) {
    try {
      const powerData = {
        timestamp: new Date(),
        totalConsumption: 0,
        byDevice: {},
        byClassroom: {},
        byDeviceType: {}
      };

      // Calculate power consumption for each device
      devices.forEach(device => {
        const devicePower = calculateDevicePowerConsumption(device);
        const classroom = device.classroom || 'unassigned';
        const deviceType = device.switches.length > 0 ? device.switches[0].type : 'unknown';

        // Store by device
        powerData.byDevice[device._id.toString()] = {
          deviceId: device._id.toString(),
          deviceName: device.name,
          classroom: classroom,
          powerConsumption: devicePower,
          switches: device.switches.length,
          activeSwitches: device.switches.filter(sw => sw.state).length,
          status: device.status
        };

        // Aggregate by classroom
        if (!powerData.byClassroom[classroom]) {
          powerData.byClassroom[classroom] = {
            classroom: classroom,
            totalPower: 0,
            deviceCount: 0,
            onlineDevices: 0,
            activeDevices: 0,
            devices: []
          };
        }

        powerData.byClassroom[classroom].totalPower += devicePower;
        powerData.byClassroom[classroom].deviceCount += 1;
        powerData.byClassroom[classroom].devices.push(device._id.toString());

        if (device.status === 'online') {
          powerData.byClassroom[classroom].onlineDevices += 1;
        }

        if (devicePower > 0) {
          powerData.byClassroom[classroom].activeDevices += 1;
        }

        // Aggregate by device type
        if (!powerData.byDeviceType[deviceType]) {
          powerData.byDeviceType[deviceType] = {
            type: deviceType,
            totalPower: 0,
            deviceCount: 0,
            activeDevices: 0
          };
        }

        powerData.byDeviceType[deviceType].totalPower += devicePower;
        powerData.byDeviceType[deviceType].deviceCount += 1;
        if (devicePower > 0) {
          powerData.byDeviceType[deviceType].activeDevices += 1;
        }

        // Add to total consumption
        powerData.totalConsumption += devicePower;
      });

      // Store in database using PowerConsumptionLog model
      const powerLog = new PowerConsumptionLog({
        timestamp: powerData.timestamp,
        totalConsumption: powerData.totalConsumption,
        byDevice: powerData.byDevice,
        byClassroom: powerData.byClassroom,
        byDeviceType: powerData.byDeviceType
      });

      await powerLog.save();

      console.log(`[POWER-MONITORING] Stored power consumption data: ${powerData.totalConsumption}W total`);

      return powerData;
    } catch (error) {
      console.error('[POWER-MONITORING] Error storing power consumption data:', error);
      return null;
    }
  }

  // Get due monitoring checks
  async getDueMonitoringChecks() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - this.checkIntervalMs);
      
      const dueDevices = await Device.find({
        $or: [
          { lastStatusCheck: { $exists: false } },
          { lastStatusCheck: { $lt: fiveMinutesAgo } }
        ]
      }).sort({ lastStatusCheck: 1 });

      return dueDevices;
    } catch (error) {
      console.error('[DUE-CHECKS-ERROR]', error);
      return [];
    }
  }

  // Force check specific device
  async forceCheckDevice(deviceId) {
    try {
      const device = await Device.findById(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      await this.checkDeviceStatus(device);
      return true;
    } catch (error) {
      console.error(`[FORCE-CHECK-ERROR]`, error);
      await EnhancedLoggingService.logError({
        errorType: 'system_error',
        severity: 'medium',
        message: 'Failed to force check device',
        details: { deviceId, error: error.message }
      });
      return false;
    }
  }

  // Utility function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkIntervalMs,
      nextCheck: this.monitoringInterval ? 
        new Date(Date.now() + this.checkIntervalMs) : null
    };
  }
}

// Export singleton instance
const deviceMonitoringService = new DeviceMonitoringService();
module.exports = deviceMonitoringService;
