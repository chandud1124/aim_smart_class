const mongoose = require('mongoose');

// Define the alert sub-schema explicitly
const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  }
}, { _id: false });

const deviceStatusLogSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  deviceName: String,
  deviceMac: String,
  checkType: {
    type: String,
    enum: ['scheduled_check', 'heartbeat', 'manual_check', 'startup_check', 'error_recovery'],
    default: 'scheduled_check'
  },
  switchStates: [{
    switchId: String,
    switchName: String,
    physicalPin: Number,
    expectedState: String,
    actualState: String,
    isMatch: Boolean,
    duration: {
      currentSession: Number, // minutes in current on/off state
      totalToday: Number, // total minutes on today
      totalWeek: Number   // total minutes on this week
    },
    powerConsumption: {
      current: Number, // watts
      totalToday: Number, // watt-hours
      totalWeek: Number  // watt-hours
    },
    lastChanged: Date,
    changeReason: String // 'manual', 'web', 'schedule', 'pir', 'unknown'
  }],
  deviceStatus: {
    isOnline: Boolean,
    wifiSignalStrength: Number,
    uptime: Number, // seconds
    freeHeap: Number, // bytes
    temperature: Number, // celsius
    lastSeen: Date,
    responseTime: Number, // milliseconds
    powerStatus: String // 'stable', 'fluctuating', 'low'
  },
  networkInfo: {
    ipAddress: String,
    gateway: String,
    subnet: String,
    dns: String,
    macAddress: String
  },
  alerts: [alertSchema],
  summary: {
    totalSwitchesOn: Number,
    totalSwitchesOff: Number,
    totalPowerConsumption: Number,
    averageResponseTime: Number,
    inconsistenciesFound: Number
  },
  classroom: String,
  location: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  nextCheckDue: Date
}, {
  timestamps: true
});

// Indexes for efficient querying
deviceStatusLogSchema.index({ deviceId: 1, timestamp: -1 });
deviceStatusLogSchema.index({ checkType: 1, timestamp: -1 });
deviceStatusLogSchema.index({ 'deviceStatus.isOnline': 1, timestamp: -1 });
deviceStatusLogSchema.index({ 'summary.inconsistenciesFound': 1, timestamp: -1 });
deviceStatusLogSchema.index({ timestamp: -1 });
deviceStatusLogSchema.index({ nextCheckDue: 1 });

module.exports = mongoose.model('DeviceStatusLog', deviceStatusLogSchema);
