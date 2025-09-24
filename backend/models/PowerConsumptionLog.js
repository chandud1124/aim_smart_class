const mongoose = require('mongoose');

// Power Consumption Log Schema
const powerConsumptionLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  totalConsumption: {
    type: Number,
    required: true,
    min: 0
  },
  byDevice: {
    type: Map,
    of: new mongoose.Schema({
      deviceId: { type: String, required: true },
      deviceName: { type: String, required: true },
      classroom: { type: String, required: true },
      powerConsumption: { type: Number, required: true, min: 0 },
      switches: { type: Number, required: true, min: 0 },
      activeSwitches: { type: Number, required: true, min: 0 },
      status: { type: String, enum: ['online', 'offline', 'error'], required: true }
    }, { _id: false })
  },
  byClassroom: {
    type: Map,
    of: new mongoose.Schema({
      classroom: { type: String, required: true },
      totalPower: { type: Number, required: true, min: 0 },
      deviceCount: { type: Number, required: true, min: 0 },
      onlineDevices: { type: Number, required: true, min: 0 },
      activeDevices: { type: Number, required: true, min: 0 },
      devices: [{ type: String }] // Array of device IDs
    }, { _id: false })
  },
  byDeviceType: {
    type: Map,
    of: new mongoose.Schema({
      type: { type: String, required: true },
      totalPower: { type: Number, required: true, min: 0 },
      deviceCount: { type: Number, required: true, min: 0 },
      activeDevices: { type: Number, required: true, min: 0 }
    }, { _id: false })
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
powerConsumptionLogSchema.index({ timestamp: -1 });
powerConsumptionLogSchema.index({ 'byClassroom.classroom': 1, timestamp: -1 });
powerConsumptionLogSchema.index({ totalConsumption: -1 });

// TTL index to automatically delete old logs (30 days)
powerConsumptionLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('PowerConsumptionLog', powerConsumptionLogSchema);