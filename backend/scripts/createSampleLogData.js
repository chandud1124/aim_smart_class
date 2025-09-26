require('dotenv').config();
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const ErrorLog = require('../models/ErrorLog');
const ManualSwitchLog = require('../models/ManualSwitchLog');
const DeviceStatusLog = require('../models/DeviceStatusLog');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function createSampleData() {
  try {
    // Create sample activity logs
    const activityLogs = await ActivityLog.create([
      {
        action: 'on',
        deviceId: '68b66fe726934448f111387d',
        deviceName: 'Classroom A Light',
        switchName: 'Main Light',
        triggeredBy: 'user',
        userName: 'Admin',
        location: 'Classroom A',
        classroom: 'Classroom A',
        timestamp: new Date()
      },
      {
        action: 'off',
        deviceId: '68b66fe726934448f111387d',
        deviceName: 'Classroom B Projector',
        switchName: 'Projector',
        triggeredBy: 'schedule',
        userName: 'System',
        location: 'Classroom B',
        classroom: 'Classroom B',
        timestamp: new Date(Date.now() - 3600000) // 1 hour ago
      }
    ]);
    console.log(`Created ${activityLogs.length} activity logs`);
    
    // Create sample error logs
    const errorLogs = await ErrorLog.create([
      {
        errorType: 'device_timeout',
        severity: 'medium',
        message: 'Device failed to respond within timeout period',
        deviceName: 'Classroom A Light',
        resolved: false,
        timestamp: new Date()
      },
      {
        errorType: 'network_error',
        severity: 'high',
        message: 'Network connection lost to device',
        deviceName: 'Classroom C Fan',
        resolved: true,
        resolvedAt: new Date(Date.now() - 1800000), // 30 minutes ago
        notes: 'Network connection restored',
        timestamp: new Date(Date.now() - 7200000) // 2 hours ago
      }
    ]);
    console.log(`Created ${errorLogs.length} error logs`);
    
    // Create sample manual switch logs
    const manualSwitchLogs = await ManualSwitchLog.create([
      {
        deviceId: '68b66fe726934448f111387d',
        deviceName: 'Classroom A Light',
        switchId: 'switch1',
        switchName: 'Main Light',
        action: 'manual_on',
        previousState: 'off',
        newState: 'on',
        conflictWith: {
          webCommand: true,
          scheduleCommand: false,
          pirCommand: false
        },
        responseTime: 250,
        location: 'Classroom A',
        timestamp: new Date()
      }
    ]);
    console.log(`Created ${manualSwitchLogs.length} manual switch logs`);
    
    // Create sample device status logs
    const deviceStatusLogs = await DeviceStatusLog.create([
      {
        deviceId: '68b66fe726934448f111387d',
        deviceName: 'Classroom A Light',
        deviceMac: 'AA:BB:CC:DD:EE:FF',
        checkType: 'scheduled_check',
        deviceStatus: {
          isOnline: true,
          wifiSignalStrength: -45,
          uptime: 12345,
          freeHeap: 45000,
          temperature: 25.5,
          responseTime: 150
        },
        summary: {
          totalSwitchesOn: 2,
          totalSwitchesOff: 1,
          inconsistenciesFound: 0
        },
        timestamp: new Date()
      },
      {
        deviceId: '68b66fe726934448f111387d',
        deviceName: 'Classroom B Projector',
        deviceMac: 'BB:CC:DD:EE:FF:AA',
        checkType: 'manual_check',
        deviceStatus: {
          isOnline: false,
          lastSeen: new Date(Date.now() - 3600000)
        },
        summary: {
          totalSwitchesOn: 0,
          totalSwitchesOff: 3,
          inconsistenciesFound: 1
        },
        timestamp: new Date(Date.now() - 1800000)
      }
    ]);
    console.log(`Created ${deviceStatusLogs.length} device status logs`);
    
    console.log('Sample data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating sample data:', error);
    process.exit(1);
  }
}

createSampleData();
