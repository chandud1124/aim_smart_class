const mongoose = require('mongoose');
const ManualSwitchLog = require('./models/ManualSwitchLog');
const ActivityLog = require('./models/ActivityLog');

async function checkManualSwitches() {
  try {
    await mongoose.connect('mongodb://localhost:27017/iot_classroom');
    console.log('Connected to MongoDB');

    const manualLogs = await ManualSwitchLog.find({}).sort({timestamp: -1}).limit(10);
    console.log('\n=== MANUAL SWITCH LOGS ===');
    console.log('Total manual switch logs:', manualLogs.length);
    manualLogs.forEach((log, i) => {
      console.log(`${i+1}. ${log.timestamp} - ${log.deviceName} - ${log.switchName} - ${log.action} - ${log.newState}`);
    });

    const activityLogs = await ActivityLog.find({triggeredBy: 'manual_switch'}).sort({timestamp: -1}).limit(10);
    console.log('\n=== ACTIVITY LOGS (manual_switch) ===');
    console.log('Total manual switch activity logs:', activityLogs.length);
    activityLogs.forEach((log, i) => {
      console.log(`${i+1}. ${log.timestamp} - ${log.deviceName} - ${log.switchName} - ${log.action} - ${log.triggeredBy}`);
    });

    const manualActions = await ActivityLog.find({
      action: { $in: ['manual_on', 'manual_off', 'manual_toggle'] }
    }).sort({timestamp: -1}).limit(10);
    console.log('\n=== ACTIVITY LOGS (manual actions) ===');
    console.log('Total manual action activity logs:', manualActions.length);
    manualActions.forEach((log, i) => {
      console.log(`${i+1}. ${log.timestamp} - ${log.deviceName} - ${log.switchName} - ${log.action} - ${log.triggeredBy}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkManualSwitches();