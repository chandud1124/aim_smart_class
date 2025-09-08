const mongoose = require('mongoose');

// Fine-grained device-level permissions
const devicePermissionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    classroom: {
        type: String,
        required: true
    },
    permissions: {
        // Basic control permissions
        canTurnOn: { type: Boolean, default: true },
        canTurnOff: { type: Boolean, default: true },
        canViewStatus: { type: Boolean, default: true },
        
        // Advanced permissions
        canSchedule: { type: Boolean, default: false },
        canModifySettings: { type: Boolean, default: false },
        canViewHistory: { type: Boolean, default: false },
        
        // Device-specific permissions
        canAdjustBrightness: { type: Boolean, default: false }, // For lights
        canAdjustSpeed: { type: Boolean, default: false },      // For fans
        canChangeInput: { type: Boolean, default: false },      // For projectors
        
        // PIR sensor permissions
        canConfigurePir: { type: Boolean, default: false },
        canViewPirData: { type: Boolean, default: true },
        canDisablePir: { type: Boolean, default: false }
    },
    restrictions: {
        // Usage limits
        maxUsesPerDay: { type: Number, default: null },
        usageToday: { type: Number, default: 0 },
        lastUsageReset: { type: Date, default: Date.now },
        
        // Time restrictions
        allowedTimeSlots: [{
            startTime: String, // "HH:MM"
            endTime: String,   // "HH:MM"
            days: [String]     // ["monday", "tuesday", ...]
        }],
        
        // Device-specific restrictions
        maxBrightnessLevel: { type: Number, default: 100 },
        maxFanSpeed: { type: Number, default: 100 },
        allowedInputSources: [String] // For projectors
    },
    temporaryOverrides: {
        enabled: { type: Boolean, default: false },
        expiresAt: Date,
        reason: String,
        grantedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    grantedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: { type: Boolean, default: true },
    expiresAt: Date,
    reason: String
}, {
    timestamps: true
});

// Index for performance
devicePermissionSchema.index({ user: 1, device: 1 });
devicePermissionSchema.index({ classroom: 1 });
devicePermissionSchema.index({ isActive: 1, expiresAt: 1 });

// Reset daily usage counter
devicePermissionSchema.methods.resetDailyUsage = function() {
    const now = new Date();
    const lastReset = new Date(this.restrictions.lastUsageReset);
    
    if (now.toDateString() !== lastReset.toDateString()) {
        this.restrictions.usageToday = 0;
        this.restrictions.lastUsageReset = now;
        return this.save();
    }
    return Promise.resolve(this);
};

module.exports = mongoose.model('DevicePermission', devicePermissionSchema);
