const BoardGroup = require('../models/BoardGroup');
const Board = require('../models/Board');
const Notice = require('../models/Notice');
const { validationResult } = require('express-validator');

// Create a new board group
const createBoardGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, type, sharedContent, settings } = req.body;

    // Check if group with same name exists
    const existingGroup = await BoardGroup.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({
        success: false,
        message: 'Board group with this name already exists'
      });
    }

    const boardGroup = new BoardGroup({
      name,
      description,
      type,
      sharedContent,
      settings,
      createdBy: req.user.id
    });

    await boardGroup.save();

    res.status(201).json({
      success: true,
      message: 'Board group created successfully',
      boardGroup
    });

  } catch (error) {
    console.error('Error creating board group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create board group',
      error: error.message
    });
  }
};

// Get all board groups
const getBoardGroups = async (req, res) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;

    const query = {};
    if (type) query.type = type;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'boards', select: 'name location status' },
        { path: 'createdBy', select: 'name email' },
        { path: 'sharedContent.notices.noticeId', select: 'title priority' }
      ]
    };

    const boardGroups = await BoardGroup.find(query)
      .sort(options.sort)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate(options.populate);

    const total = await BoardGroup.countDocuments(query);

    res.json({
      success: true,
      boardGroups,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });

  } catch (error) {
    console.error('Error fetching board groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch board groups',
      error: error.message
    });
  }
};

// Get single board group
const getBoardGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const boardGroup = await BoardGroup.findById(id)
      .populate('boards', 'name location status type')
      .populate('createdBy', 'name email')
      .populate('sharedContent.notices.noticeId', 'title content priority category');

    if (!boardGroup) {
      return res.status(404).json({
        success: false,
        message: 'Board group not found'
      });
    }

    res.json({
      success: true,
      boardGroup
    });

  } catch (error) {
    console.error('Error fetching board group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch board group',
      error: error.message
    });
  }
};

// Update board group
const updateBoardGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const boardGroup = await BoardGroup.findById(id);
    if (!boardGroup) {
      return res.status(404).json({
        success: false,
        message: 'Board group not found'
      });
    }

    // Update allowed fields
    const allowedFields = ['name', 'description', 'type', 'sharedContent', 'settings'];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        boardGroup[field] = updates[field];
      }
    });

    await boardGroup.save();

    res.json({
      success: true,
      message: 'Board group updated successfully',
      boardGroup
    });

  } catch (error) {
    console.error('Error updating board group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update board group',
      error: error.message
    });
  }
};

// Delete board group
const deleteBoardGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const boardGroup = await BoardGroup.findById(id);
    if (!boardGroup) {
      return res.status(404).json({
        success: false,
        message: 'Board group not found'
      });
    }

    // Remove all boards from this group
    if (boardGroup.boards.length > 0) {
      await Board.updateMany(
        { _id: { $in: boardGroup.boards } },
        { $unset: { groupId: 1 } }
      );
    }

    await boardGroup.deleteOne();

    res.json({
      success: true,
      message: 'Board group deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting board group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete board group',
      error: error.message
    });
  }
};

// Add board to group
const addBoardToGroup = async (req, res) => {
  try {
    const { groupId, boardId } = req.params;

    const boardGroup = await BoardGroup.findById(groupId);
    const board = await Board.findById(boardId);

    if (!boardGroup || !board) {
      return res.status(404).json({
        success: false,
        message: 'Board group or board not found'
      });
    }

    // Remove board from current group if any
    if (board.groupId) {
      const currentGroup = await BoardGroup.findById(board.groupId);
      if (currentGroup) {
        await currentGroup.removeBoard(board._id);
      }
    }

    // Add to new group
    await boardGroup.addBoard(board._id);
    board.groupId = groupId;
    await board.save();

    res.json({
      success: true,
      message: 'Board added to group successfully',
      boardGroup
    });

  } catch (error) {
    console.error('Error adding board to group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add board to group',
      error: error.message
    });
  }
};

// Remove board from group
const removeBoardFromGroup = async (req, res) => {
  try {
    const { groupId, boardId } = req.params;

    const boardGroup = await BoardGroup.findById(groupId);
    const board = await Board.findById(boardId);

    if (!boardGroup || !board) {
      return res.status(404).json({
        success: false,
        message: 'Board group or board not found'
      });
    }

    await boardGroup.removeBoard(board._id);
    board.groupId = null;
    await board.save();

    res.json({
      success: true,
      message: 'Board removed from group successfully',
      boardGroup
    });

  } catch (error) {
    console.error('Error removing board from group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove board from group',
      error: error.message
    });
  }
};

// Update shared content for group
const updateGroupSharedContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { notices, enabled } = req.body;

    const boardGroup = await BoardGroup.findById(id);
    if (!boardGroup) {
      return res.status(404).json({
        success: false,
        message: 'Board group not found'
      });
    }

    if (enabled !== undefined) {
      boardGroup.sharedContent.enabled = enabled;
    }

    if (notices) {
      // Validate notices exist
      const noticeIds = notices.map(item => item.noticeId);
      const existingNotices = await Notice.find({ _id: { $in: noticeIds } });

      if (existingNotices.length !== noticeIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more notices not found'
        });
      }

      boardGroup.sharedContent.notices = notices;
    }

    await boardGroup.save();

    res.json({
      success: true,
      message: 'Group shared content updated successfully',
      boardGroup
    });

  } catch (error) {
    console.error('Error updating group shared content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update group shared content',
      error: error.message
    });
  }
};

module.exports = {
  createBoardGroup,
  getBoardGroups,
  getBoardGroup,
  updateBoardGroup,
  deleteBoardGroup,
  addBoardToGroup,
  removeBoardFromGroup,
  updateGroupSharedContent
};