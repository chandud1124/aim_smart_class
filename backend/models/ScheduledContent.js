const mongoose = require('mongoose');

const scheduledContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Content title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true,
    maxlength: [2000, 'Content cannot exceed 2000 characters']
  },
  type: {
    type: String,
    enum: ['default', 'user', 'emergency'],
    default: 'user'
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 1
  },
  duration: {
    type: Number, // in seconds
    min: 5,
    max: 3600,
    default: 60
  },
  schedule: {
    type: {
      type: String,
      enum: ['fixed', 'recurring', 'always', 'advanced'],
      default: 'recurring'
    },
    startTime: {
      type: String,
      default: '09:00'
    },
    endTime: {
      type: String,
      default: '17:00'
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6
    }],
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      default: 'daily'
    },
    // Advanced scheduling options
    startDate: Date,
    endDate: Date,
    exceptions: [Date], // Dates to skip
    customSchedule: [{
      date: Date,
      startTime: String,
      endTime: String,
      isActive: { type: Boolean, default: true }
    }],
    recurrencePattern: {
      interval: { type: Number, default: 1 }, // Every N days/weeks/months
      byMonthDay: [Number], // Specific days of month (1-31)
      byWeekDay: [Number], // Days of week (0-6)
      count: Number, // Number of occurrences
      until: Date // End date for recurrence
    }
  },
  assignedBoards: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastPlayed: {
    type: Date
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'video', 'document', 'audio'],
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: String,
    size: Number, // in bytes
    url: String, // served URL
    path: String, // file system path
    thumbnail: String, // for images/videos
    metadata: mongoose.Schema.Types.Mixed // EXIF, duration, etc.
  }],
  display: {
    template: {
      type: String,
      enum: ['default', 'text-image', 'video-caption', 'ticker', 'split-screen'],
      default: 'default'
    },
    layout: {
      zones: [{
        id: String,
        type: { type: String, enum: ['content', 'clock', 'weather', 'news'] },
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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
scheduledContentSchema.index({ type: 1, isActive: 1 });
scheduledContentSchema.index({ 'assignedBoards': 1, isActive: 1 });
scheduledContentSchema.index({ priority: -1, createdAt: -1 });

// Virtual for checking if content should play now
scheduledContentSchema.methods.shouldPlayNow = function() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5);

  switch (this.schedule.type) {
    case 'always':
      return true;

    case 'fixed':
      return currentTime >= this.schedule.startTime &&
             currentTime <= this.schedule.endTime;

    case 'recurring':
      const isCorrectDay = this.schedule.daysOfWeek?.includes(currentDay);
      const isCorrectTime = currentTime >= this.schedule.startTime &&
                           currentTime <= this.schedule.endTime;
      return isCorrectDay && isCorrectTime;

    default:
      return false;
  }
};

// Static method to get active content for a board
scheduledContentSchema.statics.getActiveContentForBoard = function(boardId) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5);

  return this.find({
    assignedBoards: boardId,
    isActive: true
  }).sort({ priority: -1, createdAt: -1 });
};

module.exports = mongoose.model('ScheduledContent', scheduledContentSchema);