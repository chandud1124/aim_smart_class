const Notice = require('../models/Notice');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/notices/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'notice-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images, documents, and PDFs
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per notice
  }
});

// Create uploads/notices directory if it doesn't exist
const ensureUploadDir = async () => {
  const uploadDir = path.join(__dirname, '../uploads/notices/');
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
};

// Initialize upload directory
ensureUploadDir();

// Submit a new notice
const submitNotice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, content, priority, category, expiryDate, targetAudience, selectedBoards } = req.body;
    const submittedBy = req.user.id;

    // Process file attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/notices/${file.filename}`
      }));
    }

    // Parse target audience
    let parsedTargetAudience = {};
    if (targetAudience) {
      try {
        parsedTargetAudience = JSON.parse(targetAudience);
      } catch (error) {
        // If parsing fails, use default (all users)
        parsedTargetAudience = {};
      }
    }

    // Process selected boards
    let targetBoards = [];
    if (selectedBoards) {
      try {
        // selectedBoards might be a JSON string from form data
        const parsedBoards = typeof selectedBoards === 'string' ? JSON.parse(selectedBoards) : selectedBoards;
        if (Array.isArray(parsedBoards)) {
          targetBoards = parsedBoards.map(boardId => ({
            boardId: boardId,
            assignedAt: new Date(),
            assignedBy: submittedBy,
            priority: 0,
            displayOrder: 0
          }));
        }
      } catch (error) {
        console.warn('Failed to parse selectedBoards:', error.message);
        targetBoards = [];
      }
    }

    const notice = new Notice({
      title,
      content,
      priority: priority || 'medium',
      category: category || 'general',
      submittedBy,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      attachments,
      targetAudience: parsedTargetAudience,
      targetBoards
    });

    await notice.save();

    // Populate submittedBy for response
    await notice.populate('submittedBy', 'name email role');

    // Emit real-time notification
    if (req.io) {
      req.io.emit('notice_submitted', {
        notice: notice,
        message: 'New notice submitted for approval'
      });

      // Notify admins
      req.io.emit('admin_notification', {
        type: 'notice_pending_approval',
        noticeId: notice._id,
        title: notice.title,
        submittedBy: notice.submittedBy.name,
        message: 'A new notice is pending approval'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Notice submitted successfully',
      notice
    });

  } catch (error) {
    console.error('Error submitting notice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit notice',
      error: error.message
    });
  }
};

// Get all notices (with filtering)
const getNotices = async (req, res) => {
  try {
    const {
      status,
      category,
      priority,
      submittedBy,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Add filters
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (submittedBy) query.submittedBy = submittedBy;

    // Role-based access control
    if (req.user.role !== 'super-admin' && req.user.role !== 'admin') {
      // Non-admin users can only see their own notices
      query.submittedBy = req.user.id;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: [
        { path: 'submittedBy', select: 'name email role department' },
        { path: 'approvedBy', select: 'name email role' },
        { path: 'targetBoards.boardId', select: 'name location department isActive' }
      ]
    };

    const notices = await Notice.find(query)
      .sort(options.sort)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate(options.populate);

    const total = await Notice.countDocuments(query);

    res.json({
      success: true,
      notices,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });

  } catch (error) {
    console.error('Error fetching notices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notices',
      error: error.message
    });
  }
};

// Get active notices for current user
const getActiveNotices = async (req, res) => {
  try {
    const notices = await Notice.getActiveNoticesForUser(req.user);

    res.json({
      success: true,
      notices
    });

  } catch (error) {
    console.error('Error fetching active notices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active notices',
      error: error.message
    });
  }
};

// Get pending notices (for admin approval)
const getPendingNotices = async (req, res) => {
  try {
    const notices = await Notice.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('submittedBy', 'name email role department')
      .populate('approvedBy', 'name email role')
      .populate('targetBoards.boardId', 'name location department isActive');

    res.json({
      success: true,
      notices
    });

  } catch (error) {
    console.error('Error fetching pending notices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending notices',
      error: error.message
    });
  }
};

// Approve or reject notice
const reviewNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;
    const reviewedBy = req.user.id;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    if (notice.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Notice has already been reviewed'
      });
    }

    if (action === 'approve') {
      notice.status = 'approved';
      notice.approvedBy = reviewedBy;
      notice.approvedAt = new Date();
    } else if (action === 'reject') {
      notice.status = 'rejected';
      notice.approvedBy = reviewedBy;
      notice.approvedAt = new Date();
      notice.rejectionReason = rejectionReason;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }

    await notice.save();
    await notice.populate('submittedBy', 'name email role');
    await notice.populate('approvedBy', 'name email role');

    // Emit real-time notification
    if (req.io) {
      req.io.emit('notice_reviewed', {
        notice: notice,
        action: action,
        reviewedBy: req.user.name,
        message: `Notice "${notice.title}" has been ${action === 'approve' ? 'approved' : 'rejected'}`
      });

      // Notify the submitter
      req.io.to(`user_${notice.submittedBy._id}`).emit('personal_notification', {
        type: 'notice_review_result',
        noticeId: notice._id,
        title: notice.title,
        action: action,
        reviewedBy: req.user.name,
        message: `Your notice "${notice.title}" has been ${action === 'approve' ? 'approved' : 'rejected'}`
      });
    }

    res.json({
      success: true,
      message: `Notice ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      notice
    });

  } catch (error) {
    console.error('Error reviewing notice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review notice',
      error: error.message
    });
  }
};

// Publish approved notice
const publishNotice = async (req, res) => {
  try {
    const { id } = req.params;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    if (notice.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved notices can be published'
      });
    }

    notice.status = 'published';
    notice.publishedAt = new Date();
    await notice.save();

    // Emit real-time notification
    if (req.io) {
      req.io.emit('notice_published', {
        notice: notice,
        message: `Notice "${notice.title}" has been published`
      });
    }

    res.json({
      success: true,
      message: 'Notice published successfully',
      notice
    });

  } catch (error) {
    console.error('Error publishing notice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish notice',
      error: error.message
    });
  }
};

// Update notice
const updateNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'super-admin' && req.user.role !== 'admin' && notice.submittedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own notices'
      });
    }

    // Prevent updates to approved/published notices by non-admins
    if (notice.status !== 'pending' && req.user.role !== 'super-admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot update approved or published notices'
      });
    }

    // Update fields
    const allowedFields = ['title', 'content', 'priority', 'category', 'expiryDate', 'targetAudience', 'selectedBoards'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'selectedBoards') {
          // Handle board assignment updates
          try {
            const parsedBoards = typeof updates.selectedBoards === 'string' ? JSON.parse(updates.selectedBoards) : updates.selectedBoards;
            if (Array.isArray(parsedBoards)) {
              notice.targetBoards = parsedBoards.map(boardId => ({
                boardId: boardId,
                assignedAt: new Date(),
                assignedBy: req.user.id,
                priority: 0,
                displayOrder: 0
              }));
            }
          } catch (error) {
            console.warn('Failed to parse selectedBoards for update:', error.message);
          }
        } else {
          notice[field] = updates[field];
        }
      }
    });

    await notice.save();
    await notice.populate('submittedBy', 'name email role');
    await notice.populate('approvedBy', 'name email role');
    await notice.populate('targetBoards.boardId', 'name location department isActive');

    res.json({
      success: true,
      message: 'Notice updated successfully',
      notice
    });

  } catch (error) {
    console.error('Error updating notice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notice',
      error: error.message
    });
  }
};

// Delete notice
const deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'super-admin' && req.user.role !== 'admin' && notice.submittedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own notices'
      });
    }

    // Delete associated files
    if (notice.attachments && notice.attachments.length > 0) {
      for (const attachment of notice.attachments) {
        try {
          const filePath = path.join(__dirname, '../uploads/notices/', attachment.filename);
          await fs.unlink(filePath);
        } catch (fileError) {
          console.warn('Failed to delete attachment:', fileError.message);
        }
      }
    }

    await notice.deleteOne();

    res.json({
      success: true,
      message: 'Notice deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notice',
      error: error.message
    });
  }
};

// Get notice statistics
const getNoticeStats = async (req, res) => {
  try {
    const stats = await Notice.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalNotices = await Notice.countDocuments();
    const pendingCount = await Notice.countDocuments({ status: 'pending' });
    const publishedCount = await Notice.countDocuments({ status: 'published' });
    const rejectedCount = await Notice.countDocuments({ status: 'rejected' });

    res.json({
      success: true,
      stats: {
        total: totalNotices,
        pending: pendingCount,
        published: publishedCount,
        rejected: rejectedCount,
        breakdown: stats
      }
    });

  } catch (error) {
    console.error('Error fetching notice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notice statistics',
      error: error.message
    });
  }
};

module.exports = {
  submitNotice,
  getNotices,
  getActiveNotices,
  getPendingNotices,
  reviewNotice,
  publishNotice,
  updateNotice,
  deleteNotice,
  getNoticeStats,
  upload
};