const mongoose = require('mongoose');

const manualSwitchLogSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  deviceName: String,
  deviceMac: String,
  switchId: {
    type: String,
    required: true
  },
  switchName: String,
  physicalPin: Number,
  action: {
    type: String,
    enum: ['manual_on', 'manual_off', 'manual_toggle'],
    required: true
  },
  previousState: {
    type: String,
    enum: ['on', 'off', 'unknown'],
    default: 'unknown'
  },
  newState: {
    type: String,
    enum: ['on', 'off'],
    required: true
  },
  conflictWith: {
    webCommand: {
      type: Boolean,
      default: false
    },
    scheduleCommand: {
      type: Boolean,
      default: false
    },
    pirCommand: {
      type: Boolean,
      default: false
    }
  },
  detectedBy: {
    type: String,
    enum: ['gpio_interrupt', 'polling', 'status_check'],
    default: 'gpio_interrupt'
  },
  responseTime: {
    type: Number, // milliseconds
    default: 0
  },
  classroom: String,
  location: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  context: {
    activeWebUsers: Number,
    scheduledAction: String,
    pirStatus: String,
    powerConsumption: Number,
    esp32Uptime: Number
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
manualSwitchLogSchema.index({ deviceId: 1, timestamp: -1 });
manualSwitchLogSchema.index({ switchId: 1, timestamp: -1 });
manualSwitchLogSchema.index({ action: 1, timestamp: -1 });
manualSwitchLogSchema.index({ timestamp: -1 });
manualSwitchLogSchema.index({ 'conflictWith.webCommand': 1 });

module.exports = mongoose.model('ManualSwitchLog', manualSwitchLogSchema);
