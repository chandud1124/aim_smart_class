const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Board name is required'],
    trim: true,
    maxlength: [100, 'Board name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['digital', 'physical', 'projector', 'tv', 'monitor', 'raspberry_pi'],
    default: 'digital'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'offline'],
    default: 'active'
  },
  displaySettings: {
    resolution: { type: String, default: '1920x1080' },
    orientation: {
      type: String,
      enum: ['landscape', 'portrait'],
      default: 'landscape'
    },
    refreshRate: { type: Number, default: 30 },
    supportsVideo: { type: Boolean, default: true },
    supportsImages: { type: Boolean, default: true },
    maxFileSize: { type: Number, default: 10 * 1024 * 1024 } // 10MB
  },
  schedule: {
    isActive: { type: Boolean, default: true },
    operatingHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '18:00' }
    },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0=Sunday, 6=Saturday
    timezone: { type: String, default: 'Asia/Kolkata' }
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BoardGroup'
  },
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  macAddress: {
    type: String,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/.test(v);
      },
      message: 'MAC address must be in format XX:XX:XX:XX:XX:XX'
    }
  },
  ipAddress: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/.test(v);
      },
      message: 'IP address must be valid IPv4 format'
    }
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  currentContent: {
    noticeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notice' },
    startedAt: Date,
    duration: Number, // in minutes
    priority: { type: Number, default: 0 }
  },
  stats: {
    totalPlayTime: { type: Number, default: 0 }, // in minutes
    noticesDisplayed: { type: Number, default: 0 },
    lastMaintenance: Date,
    uptime: { type: Number, default: 0 } // percentage
  }
}, {
  timestamps: true
});

// Indexes
boardSchema.index({ status: 1, location: 1 });
boardSchema.index({ groupId: 1 });
boardSchema.index({ 'schedule.isActive': 1 });
boardSchema.index({ lastSeen: -1 });

// Virtual for resolution string
boardSchema.virtual('displaySettings.resolutionString').get(function() {
  if (this.displaySettings && this.displaySettings.resolution) {
    const res = this.displaySettings.resolution;
    if (typeof res === 'object' && res.width && res.height) {
      return `${res.width}x${res.height}`;
    }
    return res;
  }
  return '1920x1080';
});

// Ensure virtual fields are serialized
boardSchema.set('toJSON', { virtuals: true });
boardSchema.set('toObject', { virtuals: true });

// Method to update board status
boardSchema.methods.updateStatus = function(newStatus, additionalData = {}) {
  this.status = newStatus;
  this.lastSeen = new Date();

  if (newStatus === 'active') {
    this.isOnline = true;
  } else if (newStatus === 'offline') {
    this.isOnline = false;
  }

  Object.assign(this, additionalData);
  return this.save();
};

// Method to assign content
boardSchema.methods.assignContent = function(noticeId, duration, priority = 0) {
  this.currentContent = {
    noticeId,
    startedAt: new Date(),
    duration,
    priority
  };
  this.stats.noticesDisplayed += 1;
  return this.save();
};

// Static method to get active boards
boardSchema.statics.getActiveBoards = function() {
  return this.find({
    status: 'active',
    isOnline: true,
    'schedule.isActive': true
  });
};

// Static method to get boards by group
boardSchema.statics.getBoardsByGroup = function(groupId) {
  return this.find({ groupId });
};

module.exports = mongoose.model('Board', boardSchema);