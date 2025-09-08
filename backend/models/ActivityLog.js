
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  deviceName: String,
  switchId: String,
  switchName: String,
  action: {
    type: String,
    enum: [
      'on', 'off', 'toggle', 
      'manual_on', 'manual_off', 'manual_toggle',
      'device_created', 'device_updated', 'device_deleted', 
      'bulk_on', 'bulk_off',
      'status_check', 'heartbeat',
      'conflict_resolved'
    ],
    required: true
  },
  triggeredBy: {
    type: String,
    enum: ['user', 'schedule', 'pir', 'master', 'system', 'manual_switch', 'monitoring'],
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userName: String,
  classroom: String,
  location: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  ip: String,
  userAgent: String,
  duration: Number,
  powerConsumption: Number,
  conflictResolution: {
    hasConflict: { type: Boolean, default: false },
    conflictType: String,
    resolution: String,
    responseTime: Number
  },
  deviceStatus: {
    isOnline: Boolean,
    responseTime: Number,
    signalStrength: Number
  },
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: false
});

activityLogSchema.index({ deviceId: 1, timestamp: -1 });
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ classroom: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
