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
  targetAudience: {
    roles: [{
      type: String,
      enum: ['super-admin', 'admin', 'faculty', 'teacher', 'student', 'security', 'guest']
    }],
    departments: [String],
    classes: [String]
  },
  displayDevices: [{
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisplayDevice'
    },
    displayedAt: Date,
    displayDuration: Number // in minutes
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