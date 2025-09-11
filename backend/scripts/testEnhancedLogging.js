const mongoose = require('mongoose');
const EnhancedLoggingService = require('../services/enhancedLoggingService');
require('dotenv').config();

async function testEnhancedLogging() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autovolt');
    console.log('Connected to MongoDB');
    console.log('==========================================');
    console.log('🧪 ENHANCED LOGGING SYSTEM TEST');
    console.log('==========================================\n');

    // Test Activity Logging
    console.log('📊 Testing Activity Logging...');
    await EnhancedLoggingService.logActivity({
      action: 'switch_toggle',
      deviceId: '507f1f77bcf86cd799439011',
      switchId: '507f1f77bcf86cd799439012',
      triggeredBy: 'web',
      userId: '507f1f77bcf86cd799439013',
      isManualOverride: false,
      previousState: false,
      newState: true,
      details: {
        classroom: 'Test Room 101',
        switchName: 'Main Light',
        timestamp: new Date(),
        ipAddress: '192.168.1.100'
      }
    });
    console.log('✅ Activity log created');

    // Test Error Logging
    console.log('📊 Testing Error Logging...');
    await EnhancedLoggingService.logError({
      errorType: 'device_error',
      category: 'connectivity',
      severity: 'medium',
      source: 'ESP32Controller',
      message: 'Device connection timeout',
      deviceId: '507f1f77bcf86cd799439011',
      details: {
        mac: '80:F3:DA:65:47:38',
        lastSeen: new Date(),
        retryCount: 3
      },
      stackTrace: 'Test stack trace'
    });
    console.log('✅ Error log created');

    // Test Manual Switch Logging
    console.log('📊 Testing Manual Switch Logging...');
    await EnhancedLoggingService.logManualSwitch({
      deviceId: '507f1f77bcf86cd799439011',
      switchId: '507f1f77bcf86cd799439012',
      physicalState: true,
      webState: false,
      hasConflict: true,
      conflictResolvedBy: 'physical_override',
      details: {
        classroom: 'Test Room 101',
        switchName: 'Fan Control',
        detectionTime: new Date(),
        responseTime: 250
      }
    });
    console.log('✅ Manual switch log created');

    // Test Device Status Logging
    console.log('📊 Testing Device Status Logging...');
    await EnhancedLoggingService.logDeviceStatus({
      deviceId: '507f1f77bcf86cd799439011',
      isOnline: true,
      lastSeen: new Date(),
      switchStates: {
        '507f1f77bcf86cd799439012': { state: true, lastUpdated: new Date() },
        '507f1f77bcf86cd799439014': { state: false, lastUpdated: new Date() }
      },
      responseTime: 85,
      signalStrength: -45,
      details: {
        mac: '80:F3:DA:65:47:38',
        classroom: 'Test Room 101',
        checkType: 'automated'
      }
    });
    console.log('✅ Device status log created');

    // Test Statistics
    console.log('\n📈 Testing Enhanced Logging Statistics...');
    const stats = await EnhancedLoggingService.getLogStats();
    console.log('📊 Enhanced Logging Statistics:');
    console.log(`   Activity Logs: ${stats.activities.total} (Today: ${stats.activities.today})`);
    console.log(`   Error Logs: ${stats.errors.total} (Today: ${stats.errors.today}, Unresolved: ${stats.errors.unresolved})`);
    console.log(`   Manual Switch Logs: ${stats.manualSwitches.total} (Today: ${stats.manualSwitches.today}, Conflicts: ${stats.manualSwitches.conflicts})`);
    console.log(`   Device Status Logs: ${stats.deviceStatus.total} (Today: ${stats.deviceStatus.today})`);

    console.log('\n✅ ENHANCED LOGGING SYSTEM TEST COMPLETED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ Error testing enhanced logging:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the test
if (require.main === module) {
  testEnhancedLogging();
}

module.exports = testEnhancedLogging;
