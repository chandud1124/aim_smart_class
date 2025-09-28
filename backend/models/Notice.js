const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Notice title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Notice content is required'],
    trim: true,
    maxlength: [2000, 'Content cannot exceed 2000 characters']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['general', 'academic', 'administrative', 'event', 'emergency', 'maintenance'],
    default: 'general'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'published', 'archived'],
    default: 'pending'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  publishedAt: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  targetBoards: [{
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board'
    },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority: { type: Number, default: 0 },
    displayOrder: { type: Number, default: 0 }
  }],
  schedule: {
    type: {
      type: String,
      enum: ['fixed', 'recurring', 'playlist'],
      default: 'fixed'
    },
    startDate: Date,
    endDate: Date,
    duration: { type: Number, default: 60 }, // minutes
    recurring: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'daily'
      },
      daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0=Sunday, 6=Saturday
      timeSlots: [{
        startTime: String, // HH:MM format
        endTime: String
      }]
    },
    playlist: {
      items: [{
        content: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Notice'
        },
        duration: Number, // minutes
        order: Number
      }],
      loop: { type: Boolean, default: true },
      shuffle: { type: Boolean, default: false }
    }
  },
  display: {
    template: {
      type: String,
      enum: ['default', 'text-image', 'video-caption', 'ticker', 'split-screen'],
      default: 'default'
    },
    layout: {
      zones: [{
        id: String,
        type: { type: String, enum: ['notice', 'weather', 'clock', 'news', 'custom'] },
        position: {
          x: Number,
          y: Number,
          width: Number,
          height: Number
        },
        content: mongoose.Schema.Types.Mixed
      }]
    },
    transitions: {
      type: {
        type: String,
        enum: ['fade', 'slide', 'zoom', 'none'],
        default: 'fade'
      },
      duration: { type: Number, default: 1000 } // milliseconds
    }
  },
  isDraft: {
    type: Boolean,
    default: false
  },
  playbackHistory: [{
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
    startedAt: Date,
    endedAt: Date,
    duration: Number, // actual display time in minutes
    userInteractions: [{
      type: { type: String, enum: ['view', 'click', 'dismiss'] },
      timestamp: Date,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rejectionReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
noticeSchema.index({ status: 1, createdAt: -1 });
noticeSchema.index({ submittedBy: 1, createdAt: -1 });
noticeSchema.index({ 'targetAudience.roles': 1 });
noticeSchema.index({ 'targetAudience.departments': 1 });
noticeSchema.index({ expiryDate: 1 });
noticeSchema.index({ isActive: 1, status: 1 });

// Virtual for checking if notice is expired
noticeSchema.virtual('isExpired').get(function() {
  return this.expiryDate && this.expiryDate < new Date();
});

// Virtual for formatted expiry date
noticeSchema.virtual('formattedExpiryDate').get(function() {
  return this.expiryDate ? this.expiryDate.toISOString().split('T')[0] : null;
});

// Pre-save middleware to set publishedAt when status changes to published
noticeSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// Static method to get active notices for a user
noticeSchema.statics.getActiveNoticesForUser = function(user) {
  const now = new Date();
  const query = {
    isActive: true,
    status: 'published',
    $or: [
      { expiryDate: { $exists: false } },
      { expiryDate: { $gt: now } }
    ]
  };

  // Add audience filtering
  const audienceConditions = [];

  if (user.role) {
    audienceConditions.push({ 'targetAudience.roles': user.role });
    audienceConditions.push({ 'targetAudience.roles': { $exists: false } });
    audienceConditions.push({ 'targetAudience.roles': { $size: 0 } });
  }

  if (user.department) {
    audienceConditions.push({ 'targetAudience.departments': user.department });
  }

  if (user.class) {
    audienceConditions.push({ 'targetAudience.classes': user.class });
  }

  if (audienceConditions.length > 0) {
    query.$or = query.$or || [];
    query.$or.push(...audienceConditions);
  }

  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

module.exports = mongoose.model('Notice', noticeSchema);