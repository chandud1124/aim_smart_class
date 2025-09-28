const Board = require('../models/Board');
const BoardGroup = require('../models/BoardGroup');
const Notice = require('../models/Notice');
const { validationResult } = require('express-validator');

// Create a new board
const createBoard = async (req, res) => {
  try {
    console.log('Creating board, req.user:', req.user);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, location, type, displaySettings, schedule, groupId, macAddress, ipAddress } = req.body;
    console.log('Board data:', { name, description, location, type, groupId, macAddress, ipAddress });

    // Check if board with same name and location exists
    const existingBoard = await Board.findOne({ name, location });
    if (existingBoard) {
      return res.status(400).json({
        success: false,
        message: 'Board with this name already exists at this location'
      });
    }

    // For Raspberry Pi devices, check if MAC address is unique
    if (type === 'raspberry_pi' && macAddress) {
      const existingMac = await Board.findOne({ macAddress, type: 'raspberry_pi' });
      if (existingMac) {
        return res.status(400).json({
          success: false,
          message: 'A Raspberry Pi device with this MAC address already exists'
        });
      }
    }

    const board = new Board({
      name,
      description,
      location,
      type,
      displaySettings,
      schedule,
      groupId,
      macAddress,
      ipAddress,
      assignedUsers: [req.user.id]
    });
    console.log('Board object created:', board);

    await board.save();
    console.log('Board saved successfully, board._id:', board._id);

    // Add to group if specified
    if (groupId) {
      console.log('Adding to group:', groupId);
      const group = await BoardGroup.findById(groupId);
      if (group) {
        await group.addBoard(board._id);
      }
    }

    // Populate groupId only if it exists
    if (board.groupId) {
      console.log('Populating groupId');
      await board.populate('groupId', 'name type');
    }

    console.log('Board creation completed successfully');
    res.status(201).json({
      success: true,
      message: 'Board created successfully',
      board
    });

  } catch (error) {
    console.error('Error creating board:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create board',
      error: error.message
    });
  }
};

// Get all boards with filtering
const getBoards = async (req, res) => {
  try {
    const {
      status,
      location,
      type,
      groupId,
      page = 1,
      limit = 10,
      includeInactive = false
    } = req.query;

    const query = {};

    // Add filters
    if (status) query.status = status;
    if (location) query.location = new RegExp(location, 'i');
    if (type) query.type = type;
    if (groupId) query.groupId = groupId;

    // Only show active boards unless specifically requested
    if (!includeInactive && req.query.includeInactive !== 'true') {
      query.status = { $ne: 'inactive' };
    }

    // Role-based access control
    if (req.user.role !== 'super-admin' && req.user.role !== 'admin') {
      // Non-admin users can only see boards they're assigned to
      query.assignedUsers = req.user.id;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'groupId', select: 'name type' },
        { path: 'assignedUsers', select: 'name email' },
        { path: 'currentContent.noticeId', select: 'title priority' }
      ]
    };

    const boards = await Board.find(query)
      .sort(options.sort)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate(options.populate);

    const total = await Board.countDocuments(query);

    res.json({
      success: true,
      boards,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });

  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch boards',
      error: error.message
    });
  }
};

// Get single board
const getBoard = async (req, res) => {
  try {
    const { id } = req.params;

    const board = await Board.findById(id)
      .populate('groupId', 'name type description')
      .populate('assignedUsers', 'name email role')
      .populate('currentContent.noticeId', 'title content priority category');

    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'super-admin' && req.user.role !== 'admin' &&
        !board.assignedUsers.some(user => user._id.toString() === req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this board'
      });
    }

    res.json({
      success: true,
      board
    });

  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch board',
      error: error.message
    });
  }
};

// Update board
const updateBoard = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const board = await Board.findById(id);
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'name', 'description', 'location', 'type', 'status',
      'displaySettings', 'schedule', 'groupId', 'assignedUsers',
      'macAddress', 'ipAddress'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        board[field] = updates[field];
      }
    });

    // Handle group changes
    if (updates.groupId !== undefined) {
      // Remove from old group
      if (board.groupId) {
        const oldGroup = await BoardGroup.findById(board.groupId);
        if (oldGroup) {
          await oldGroup.removeBoard(board._id);
        }
      }

      // Add to new group
      if (updates.groupId) {
        const newGroup = await BoardGroup.findById(updates.groupId);
        if (newGroup) {
          await newGroup.addBoard(board._id);
        }
      }
    }

    await board.save();
    await board.populate('groupId', 'name type');

    res.json({
      success: true,
      message: 'Board updated successfully',
      board
    });

  } catch (error) {
    console.error('Error updating board:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update board',
      error: error.message
    });
  }
};

// Delete board
const deleteBoard = async (req, res) => {
  try {
    const { id } = req.params;

    const board = await Board.findById(id);
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Remove from group if assigned
    if (board.groupId) {
      const group = await BoardGroup.findById(board.groupId);
      if (group) {
        await group.removeBoard(board._id);
      }
    }

    await board.deleteOne();

    res.json({
      success: true,
      message: 'Board deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete board',
      error: error.message
    });
  }
};

// Get board content (current notices)
const getBoardContent = async (req, res) => {
  try {
    const { id } = req.params;

    const board = await Board.findById(id)
      .populate('currentContent.noticeId')
      .populate('groupId');

    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Get notices assigned to this board
    const boardNotices = await Notice.find({
      'targetBoards.boardId': board._id,
      status: 'published',
      isActive: true
    }).sort({ 'targetBoards.displayOrder': 1, priority: -1 });

    // Get group content if applicable
    let groupContent = [];
    if (board.groupId && board.groupId.sharedContent.enabled) {
      groupContent = await Notice.find({
        _id: { $in: board.groupId.sharedContent.notices.map(item => item.noticeId) },
        status: 'published',
        isActive: true
      });
    }

    res.json({
      success: true,
      content: {
        current: board.currentContent,
        boardNotices,
        groupContent,
        board: {
          id: board._id,
          name: board.name,
          isOperating: board.isOperating
        }
      }
    });

  } catch (error) {
    console.error('Error fetching board content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch board content',
      error: error.message
    });
  }
};

// Update board content (assign notice to board)
const updateBoardContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { noticeId, duration, priority } = req.body;

    const board = await Board.findById(id);
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    if (noticeId) {
      // Assign notice to board
      const notice = await Notice.findById(noticeId);
      if (!notice) {
        return res.status(404).json({
          success: false,
          message: 'Notice not found'
        });
      }

      // Check if notice is already assigned to this board
      const existingAssignment = notice.targetBoards.find(
        assignment => assignment.boardId.toString() === id
      );

      if (!existingAssignment) {
        notice.targetBoards.push({
          boardId: id,
          assignedBy: req.user.id,
          priority: priority || 0
        });
        await notice.save();
      }

      // Update board's current content
      await board.assignContent(noticeId, duration || 60, priority || 0);
    } else {
      // Clear current content
      board.currentContent = null;
      await board.save();
    }

    res.json({
      success: true,
      message: 'Board content updated successfully',
      board
    });

  } catch (error) {
    console.error('Error updating board content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update board content',
      error: error.message
    });
  }
};

// Get board statistics
const getBoardStats = async (req, res) => {
  try {
    const { id } = req.params;

    const board = await Board.findById(id);
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Get playback history
    const playbackHistory = await Notice.aggregate([
      { $unwind: '$playbackHistory' },
      { $match: { 'playbackHistory.boardId': board._id } },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: 1 },
          totalDuration: { $sum: '$playbackHistory.duration' },
          avgDuration: { $avg: '$playbackHistory.duration' },
          lastPlayed: { $max: '$playbackHistory.startedAt' }
        }
      }
    ]);

    const stats = playbackHistory[0] || {
      totalPlays: 0,
      totalDuration: 0,
      avgDuration: 0,
      lastPlayed: null
    };

    res.json({
      success: true,
      stats: {
        board: {
          id: board._id,
          name: board.name,
          status: board.status,
          isOnline: board.isOnline,
          uptime: board.stats.uptime,
          totalPlayTime: board.stats.totalPlayTime,
          noticesDisplayed: board.stats.noticesDisplayed,
          lastMaintenance: board.stats.lastMaintenance
        },
        playback: stats
      }
    });

  } catch (error) {
    console.error('Error fetching board stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch board statistics',
      error: error.message
    });
  }
};

module.exports = {
  createBoard,
  getBoards,
  getBoard,
  updateBoard,
  deleteBoard,
  getBoardContent,
  updateBoardContent,
  getBoardStats
};