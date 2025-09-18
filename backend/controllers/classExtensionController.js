const ClassExtensionRequest = require('../models/ClassExtensionRequest');
const ActivityLog = require('../models/ActivityLog');
const { logger } = require('../middleware/logger');

// Create a new class extension request
const createExtensionRequest = async (req, res) => {
  try {
    const {
      scheduleId,
      originalEndTime,
      requestedEndTime,
      reason,
      priority,
      roomNumber,
      subject,
      classDetails
    } = req.body;

    // Validate required fields
    if (!scheduleId || !originalEndTime || !requestedEndTime || !reason) {
      return res.status(400).json({
        message: 'Schedule ID, original end time, requested end time, and reason are required'
      });
    }

    // Calculate extension duration
    const extensionDuration = Math.round(
      (new Date(requestedEndTime) - new Date(originalEndTime)) / (1000 * 60)
    );

    if (extensionDuration <= 0) {
      return res.status(400).json({
        message: 'Requested end time must be after original end time'
      });
    }

    if (extensionDuration > 120) { // Max 2 hours
      return res.status(400).json({
        message: 'Extension cannot exceed 2 hours'
      });
    }

    // Check if user can request extensions
    if (!req.user.permissions?.canRequestExtensions) {
      return res.status(403).json({
        message: 'You do not have permission to request class extensions'
      });
    }

    // Create the extension request
    const extensionRequest = await ClassExtensionRequest.create({
      requestedBy: req.user._id,
      scheduleId,
      originalEndTime,
      requestedEndTime,
      extensionDuration,
      reason,
      priority: priority || 'medium',
      roomNumber,
      subject,
      classDetails
    });

    // Log activity
    await ActivityLog.create({
      action: 'extension_requested',
      triggeredBy: 'user',
      userId: req.user._id,
      userName: req.user.name,
      classroom: roomNumber,
      location: 'class_extension',
      details: `Requested ${extensionDuration} minute extension for ${subject || 'class'} in ${roomNumber}`
    });

    // Populate the response
    await extensionRequest.populate('requestedBy', 'name email role department');

    res.status(201).json(extensionRequest);
  } catch (error) {
    logger.error('Error creating extension request:', error);
    res.status(500).json({ message: 'Error creating extension request' });
  }
};

// Get extension requests for the current user
const getMyExtensionRequests = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const status = req.query.status;

    let filter = { requestedBy: req.user._id };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await ClassExtensionRequest.countDocuments(filter);
    const requests = await ClassExtensionRequest.find(filter)
      .populate('approvedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      data: requests,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Error fetching user extension requests:', error);
    res.status(500).json({ message: 'Error fetching extension requests' });
  }
};

// Get pending extension requests for approval
const getPendingApprovals = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

    // Check if user can approve extensions
    if (!req.user.permissions?.canApproveExtensions) {
      return res.status(403).json({
        message: 'You do not have permission to approve extension requests'
      });
    }

    const requests = await ClassExtensionRequest.getPendingRequestsForApproval(
      req.user.role,
      req.user.department
    );

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRequests = requests.slice(startIndex, endIndex);

    res.json({
      data: paginatedRequests,
      page,
      limit,
      total: requests.length,
      totalPages: Math.ceil(requests.length / limit)
    });
  } catch (error) {
    logger.error('Error fetching pending approvals:', error);
    res.status(500).json({ message: 'Error fetching pending approvals' });
  }
};

// Approve or reject an extension request
const processExtensionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        message: 'Action must be either "approve" or "reject"'
      });
    }

    const extensionRequest = await ClassExtensionRequest.findById(id)
      .populate('requestedBy', 'name email role department')
      .populate('scheduleId');

    if (!extensionRequest) {
      return res.status(404).json({ message: 'Extension request not found' });
    }

    if (extensionRequest.status !== 'pending') {
      return res.status(400).json({
        message: 'This request has already been processed'
      });
    }

    // Check if user can approve this request
    if (!extensionRequest.canBeApprovedBy(req.user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to process this extension request'
      });
    }

    if (action === 'approve') {
      // Check for conflicts before approving
      const conflicts = await extensionRequest.checkConflicts();
      if (conflicts.length > 0) {
        return res.status(400).json({
          message: 'Cannot approve: scheduling conflicts detected',
          conflicts: conflicts.map(c => ({
            id: c._id,
            subject: c.subject,
            startTime: c.startTime,
            endTime: c.endTime
          }))
        });
      }

      extensionRequest.status = 'approved';
      extensionRequest.approvedBy = req.user._id;
      extensionRequest.approvedAt = new Date();

      // Update the original schedule if it exists
      if (extensionRequest.scheduleId) {
        const Schedule = require('../models/Schedule');
        await Schedule.findByIdAndUpdate(extensionRequest.scheduleId, {
          endTime: extensionRequest.requestedEndTime
        });
      }
    } else {
      // Reject the request
      if (!rejectionReason) {
        return res.status(400).json({
          message: 'Rejection reason is required'
        });
      }

      extensionRequest.status = 'rejected';
      extensionRequest.approvedBy = req.user._id;
      extensionRequest.approvedAt = new Date();
      extensionRequest.rejectionReason = rejectionReason;
    }

    await extensionRequest.save();

    // Log activity
    await ActivityLog.create({
      action: action === 'approve' ? 'extension_approved' : 'extension_rejected',
      triggeredBy: 'user',
      userId: req.user._id,
      userName: req.user.name,
      classroom: extensionRequest.roomNumber,
      location: 'class_extension',
      details: `${action === 'approve' ? 'Approved' : 'Rejected'} ${extensionRequest.extensionDuration} minute extension request from ${extensionRequest.requestedBy.name}`
    });

    // Populate the response
    await extensionRequest.populate('approvedBy', 'name email role');

    res.json(extensionRequest);
  } catch (error) {
    logger.error('Error processing extension request:', error);
    res.status(500).json({ message: 'Error processing extension request' });
  }
};

// Get all extension requests (admin only)
const getAllExtensionRequests = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const status = req.query.status;
    const requestedBy = req.query.requestedBy;
    const roomNumber = req.query.roomNumber;

    let filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (requestedBy) {
      filter.requestedBy = requestedBy;
    }
    if (roomNumber) {
      filter.roomNumber = roomNumber;
    }

    const total = await ClassExtensionRequest.countDocuments(filter);
    const requests = await ClassExtensionRequest.find(filter)
      .populate('requestedBy', 'name email role department')
      .populate('approvedBy', 'name email role')
      .populate('scheduleId', 'subject startTime endTime')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      data: requests,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Error fetching all extension requests:', error);
    res.status(500).json({ message: 'Error fetching extension requests' });
  }
};

// Add a comment to an extension request
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: 'Comment is required' });
    }

    const extensionRequest = await ClassExtensionRequest.findById(id);
    if (!extensionRequest) {
      return res.status(404).json({ message: 'Extension request not found' });
    }

    // Check if user can view this request
    const canView = req.user.permissions?.canApproveExtensions ||
                    extensionRequest.requestedBy.toString() === req.user._id.toString() ||
                    req.user.role === 'super-admin' ||
                    req.user.role === 'admin';

    if (!canView) {
      return res.status(403).json({ message: 'Not authorized to view this request' });
    }

    extensionRequest.comments.push({
      userId: req.user._id,
      comment: comment.trim()
    });

    await extensionRequest.save();

    // Populate the new comment
    await extensionRequest.populate('comments.userId', 'name email role');

    res.json(extensionRequest.comments[extensionRequest.comments.length - 1]);
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ message: 'Error adding comment' });
  }
};

// Get extension request statistics
const getExtensionStats = async (req, res) => {
  try {
    const stats = await ClassExtensionRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgDuration: { $avg: '$extensionDuration' }
        }
      }
    ]);

    const totalRequests = stats.reduce((sum, stat) => sum + stat.count, 0);
    const approvalRate = totalRequests > 0 ?
      (stats.find(s => s._id === 'approved')?.count || 0) / totalRequests * 100 : 0;

    res.json({
      totalRequests,
      approvalRate: Math.round(approvalRate * 100) / 100,
      statusBreakdown: stats,
      recentRequests: await ClassExtensionRequest.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      })
    });
  } catch (error) {
    logger.error('Error fetching extension stats:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
};

module.exports = {
  createExtensionRequest,
  getMyExtensionRequests,
  getPendingApprovals,
  processExtensionRequest,
  getAllExtensionRequests,
  addComment,
  getExtensionStats
};