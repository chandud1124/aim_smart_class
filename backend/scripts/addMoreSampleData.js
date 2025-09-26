require('dotenv').config();
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const ErrorLog = require('../models/ErrorLog');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function addMoreSampleData() {
  try {
    // Add more diverse activity logs
    const moreActivityLogs = await ActivityLog.create([
      {
        action: 'manual_on',
        deviceId: '68b66fe726934448f111387d',
        deviceName: 'Smart Board Room A',
        switchName: 'Smart Board',
        triggeredBy: 'manual_switch',
        userName: 'Teacher',
        location: 'Room A',
        classroom: 'Room A',
        timestamp: new Date(Date.now() - 7200000) // 2 hours ago
      },
      {
        action: 'bulk_off',
        deviceId: '68b66fe726934448f111387d',
        deviceName: 'Laboratory Lights',
        triggeredBy: 'schedule',
        userName: 'System',
        location: 'Laboratory',
        classroom: 'Laboratory',
        timestamp: new Date(Date.now() - 10800000) // 3 hours ago
      },
      {
        action: 'on',
        deviceId: '68b66fe726934448f111387d',
        deviceName: 'Conference Room AC',
        switchName: 'Air Conditioner',
        triggeredBy: 'pir',
        location: 'Conference Room',
        classroom: 'Conference Room',
        timestamp: new Date(Date.now() - 5400000) // 1.5 hours ago
      }
    ]);
    console.log(`Added ${moreActivityLogs.length} more activity logs`);
    
    // Add more error logs with different severities
    const moreErrorLogs = await ErrorLog.create([
      {
        errorType: 'authentication_failed',
        severity: 'low',
        message: 'Invalid login attempt detected',
        resolved: true,
        resolvedAt: new Date(Date.now() - 1800000),
        notes: 'User password reset completed',
        timestamp: new Date(Date.now() - 3600000)
      },
      {
        errorType: 'system_error',
        severity: 'critical',
        message: 'Database connection pool exhausted',
        resolved: false,
        timestamp: new Date(Date.now() - 900000) // 15 minutes ago
      },
      {
        errorType: 'esp32_error',
        severity: 'high',
        message: 'ESP32 device boot loop detected',
        deviceId: '68b66fe726934448f111387d',
        deviceName: 'Classroom C Fan',
        resolved: false,
        timestamp: new Date(Date.now() - 2700000) // 45 minutes ago
      }
    ]);
    console.log(`Added ${moreErrorLogs.length} more error logs`);
    
    console.log('Additional sample data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating additional sample data:', error);
    process.exit(1);
  }
}

addMoreSampleData();
