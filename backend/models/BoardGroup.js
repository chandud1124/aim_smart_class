const mongoose = require('mongoose');

const boardGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['location', 'department', 'building', 'floor', 'custom'],
    default: 'custom'
  },
  boards: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board'
  }],
  sharedContent: {
    enabled: { type: Boolean, default: false },
    priority: { type: Number, default: 0 }, // Higher priority content overrides individual board content
    notices: [{
      noticeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notice' },
      addedAt: { type: Date, default: Date.now },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
  },
  settings: {
    defaultDuration: { type: Number, default: 60 }, // minutes
    maxConcurrentNotices: { type: Number, default: 1 },
    allowOverride: { type: Boolean, default: true }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
boardGroupSchema.index({ type: 1, isActive: 1 });
boardGroupSchema.index({ createdBy: 1 });

// Method to add board to group
boardGroupSchema.methods.addBoard = function(boardId) {
  if (!this.boards.includes(boardId)) {
    this.boards.push(boardId);
  }
  return this.save();
};

// Method to remove board from group
boardGroupSchema.methods.removeBoard = function(boardId) {
  this.boards = this.boards.filter(id => !id.equals(boardId));
  return this.save();
};

// Method to add shared content
boardGroupSchema.methods.addSharedContent = function(noticeId, userId) {
  if (!this.sharedContent.notices.some(item => item.noticeId.equals(noticeId))) {
    this.sharedContent.notices.push({
      noticeId,
      addedBy: userId
    });
  }
  return this.save();
};

// Static method to get active groups
boardGroupSchema.statics.getActiveGroups = function() {
  return this.find({ isActive: true }).populate('boards');
};

module.exports = mongoose.model('BoardGroup', boardGroupSchema);