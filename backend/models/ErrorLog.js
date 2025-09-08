const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  errorType: {
    type: String,
    enum: [
      'authentication_failed',
      'authorization_failed', 
      'device_connection_failed',
      'device_timeout',
      'invalid_command',
      'network_error',
      'database_error',
      'validation_error',
      'esp32_error',
      'system_error',
      'manual_switch_conflict',
      'websocket_error',
      'api_error',
      'permission_denied'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  },
  deviceName: String,
  deviceMac: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userName: String,
  userRole: String,
  ip: String,
  userAgent: String,
  endpoint: String,
  method: String,
  statusCode: Number,
  responseTime: Number,
  stackTrace: String,
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
errorLogSchema.index({ errorType: 1, timestamp: -1 });
errorLogSchema.index({ severity: 1, timestamp: -1 });
errorLogSchema.index({ deviceId: 1, timestamp: -1 });
errorLogSchema.index({ userId: 1, timestamp: -1 });
errorLogSchema.index({ resolved: 1, timestamp: -1 });
errorLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
