const mongoose = require('mongoose');
const gpioUtils = require('../utils/gpioUtils');

const switchTypes = ['relay', 'light', 'fan', 'outlet', 'projector', 'ac'];

const switchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Switch name is required'],
    trim: true
  },
  gpio: {
    type: Number,
    required: [true, 'GPIO pin number is required'],
    min: [0, 'GPIO pin must be >= 0'],
    max: [39, 'GPIO pin must be <= 39'],
    validate: {
      validator: function(v) {
        // Allow problematic pins for existing devices during updates to prevent bulk toggle failures
        // Only enforce strict validation for new devices
        return gpioUtils.validateGpioPin(v, true); // Allow problematic pins
      },
      message: function(props) {
        const status = gpioUtils.getGpioPinStatus(props.value);
        return status.reason;
      }
    }
  },
  type: {
    type: String,
    required: [true, 'Switch type is required'],
    enum: {
      values: switchTypes,
      message: 'Invalid switch type. Must be one of: ' + switchTypes.join(', ')
    }
  },
  state: {
    type: Boolean,
    default: false,
    index: true // Index for state queries
  },
  icon: {
    type: String,
    default: 'lightbulb'
  },
  manualSwitchEnabled: {
    type: Boolean,
    default: false
  },
  manualSwitchGpio: {
    type: Number,
    min: [0, 'GPIO pin must be >= 0'],
    max: [39, 'GPIO pin must be <= 39'],
    validate: {
      validator: function(v) {
        if (v === undefined || v === null) return true;
        // Allow problematic pins for existing devices during updates
        return gpioUtils.validateGpioPin(v, true); // Allow problematic pins
      },
      message: function(props) {
        const status = gpioUtils.getGpioPinStatus(props.value);
        return status.reason;
      }
    }
  },
  manualMode: {
    type: String,
    enum: ['maintained', 'momentary'],
    default: 'maintained'
  },
  manualActiveLow: {
    type: Boolean,
    default: true
  },
  usePir: {
    type: Boolean,
    default: false
  },
  dontAutoOff: {
    type: Boolean,
    default: false
  },
  manualOverride: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const deviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Device name is required'],
    trim: true
  },
  deviceType: {
    type: String,
    enum: ['esp32'],
    default: 'esp32'
  },
  macAddress: {
    type: String,
    required: [true, 'MAC address is required'],
    unique: true,
    match: [/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Please enter a valid MAC address']
  },
  ipAddress: {
    type: String,
    required: [true, 'IP address is required'],
    unique: true,
    match: [/^(\d{1,3}\.){3}\d{1,3}$/, 'Please enter a valid IP address']
  },
  deviceSecret: {
    type: String,
    required: false,
    select: false,
    minlength: 16,
    maxlength: 128
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  classroom: {
    type: String,
    trim: true,
    optional: true
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'error'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  switches: {
    type: [switchSchema],
    validate: [
      {
        validator: function(switches) {
          return switches.length <= 8;
        },
        message: 'Maximum 8 switches allowed per ESP32 device'
      },
      {
        validator: function(switches) {
          const gpios = switches.map(s => s.gpio);
          const manual = switches.filter(s => s.manualSwitchEnabled && s.manualSwitchGpio !== undefined).map(s => s.manualSwitchGpio);
          const all = [...gpios, ...manual];
          return new Set(all).size === all.length;
        },
        message: 'Each switch (including manual switch GPIOs) must use a unique GPIO pin'
      }
    ],
    required: true
  },
  pirEnabled: {
    type: Boolean,
    default: false
  },
  pirGpio: {
    type: Number,
    required: function() { return this.pirEnabled; },
    min: [0, 'GPIO pin must be >= 0'],
    max: [39, 'GPIO pin must be <= 39'],
    validate: {
      validator: function(v) {
        if (!this.pirEnabled) return true;
        // Allow problematic pins for existing devices during updates
        return gpioUtils.validateGpioPin(v, true); // Allow problematic pins
      },
      message: function(props) {
        const status = gpioUtils.getGpioPinStatus(props.value);
        return status.reason;
      }
    }
  },
  pirAutoOffDelay: {
    type: Number,
    min: 0,
    default: 30 // 30 seconds default
  },
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
  ,
  // Store queued toggle intents when user tries while offline
  queuedIntents: {
    type: [new mongoose.Schema({
      switchGpio: Number,
      desiredState: Boolean,
      createdAt: { type: Date, default: Date.now }
    }, { _id: false })],
    default: []
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
deviceSchema.index({ macAddress: 1 }, { unique: true });
deviceSchema.index({ ipAddress: 1 }, { unique: true });
deviceSchema.index({ assignedUsers: 1 });
deviceSchema.index({ classroom: 1 }); // Index for classroom-based queries
deviceSchema.index({ status: 1 }); // Index for status filtering
deviceSchema.index({ location: 1 }); // Index for location-based queries
deviceSchema.index({ lastSeen: -1 }); // Index for recent device queries

// Pre-save middleware to ensure switches have unique names
deviceSchema.pre('save', function(next) {
  const switchNames = new Set();
  for (const sw of this.switches) {
    if (switchNames.has(sw.name)) {
      next(new Error('Switch names must be unique within a device'));
      return;
    }
    switchNames.add(sw.name);
  }
  next();
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
module.exports.GPIOUtils = gpioUtils;
