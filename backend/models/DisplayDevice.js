const mongoose = require('mongoose');

const displayDeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  type: { type: String, enum: ['raspberry_pi', 'monitor', 'projector'], default: 'raspberry_pi' },
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance'],
    default: 'offline'
  },
  lastSeen: { type: Date },
  screenResolution: {
    width: { type: Number, default: 1920 },
    height: { type: Number, default: 1080 }
  },
  capabilities: {
    video: { type: Boolean, default: true },
    image: { type: Boolean, default: true },
    text: { type: Boolean, default: true },
    pdf: { type: Boolean, default: false }
  },
  currentContent: { type: mongoose.Schema.Types.ObjectId, ref: 'Notice' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DisplayDevice', displayDeviceSchema);