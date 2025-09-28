const ScheduledContent = require('../models/ScheduledContent');
const Board = require('../models/Board');
const { validationResult } = require('express-validator');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // For image processing

// Create scheduled content
const createScheduledContent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      title,
      content,
      type,
      priority,
      duration,
      schedule,
      assignedBoards,
      selectedAttachments
    } = req.body;

    // Verify all assigned boards exist
    const boards = await Board.find({ _id: { $in: assignedBoards } });
    if (boards.length !== assignedBoards.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more assigned boards do not exist'
      });
    }

    // Process selected attachments
    let attachments = [];
    if (selectedAttachments && selectedAttachments.length > 0) {
      const mediaDir = path.join(__dirname, '../uploads/media');

      for (const filename of selectedAttachments) {
        try {
          const filePath = path.join(mediaDir, filename);
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const ext = path.extname(filename).toLowerCase();

            // Determine file type
            let fileType = 'document';
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) fileType = 'image';
            else if (['.mp4', '.avi', '.mov', '.wmv'].includes(ext)) fileType = 'video';
            else if (['.mp3', '.wav', '.m4a'].includes(ext)) fileType = 'audio';

            // Check for thumbnail
            const thumbnailName = `thumb-${filename}`;
            const thumbnailPath = path.join(mediaDir, thumbnailName);
            const thumbnail = fs.existsSync(thumbnailPath) ? `/uploads/media/${thumbnailName}` : null;

            attachments.push({
              type: fileType,
              filename,
              originalName: filename, // We use filename as original name since we don't store the original
              url: `/uploads/media/${filename}`,
              path: filePath,
              thumbnail,
              size: stats.size,
              mimeType: 'application/octet-stream' // Default, could be improved
            });
          }
        } catch (error) {
          console.warn(`Error processing attachment ${filename}:`, error);
          // Continue with other attachments
        }
      }
    }

    const scheduledContent = new ScheduledContent({
      title,
      content,
      type,
      priority,
      duration,
      schedule,
      assignedBoards,
      attachments,
      createdBy: req.user.id
    });

    await scheduledContent.save();

    // Populate board details for response
    await scheduledContent.populate('assignedBoards', 'name location');
    await scheduledContent.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Scheduled content created successfully',
      content: scheduledContent
    });

  } catch (error) {
    console.error('Error creating scheduled content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create scheduled content',
      error: error.message
    });
  }
};

// Get all scheduled content
const getScheduledContent = async (req, res) => {
  try {
    const {
      type,
      isActive,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Add filters
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: [
        { path: 'assignedBoards', select: 'name location type' },
        { path: 'createdBy', select: 'name email' }
      ]
    };

    const content = await ScheduledContent.find(query)
      .sort(options.sort)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate(options.populate);

    const total = await ScheduledContent.countDocuments(query);

    res.json({
      success: true,
      content,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });

  } catch (error) {
    console.error('Error fetching scheduled content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled content',
      error: error.message
    });
  }
};

// Get active content for a specific board
const getActiveContentForBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    // Find content assigned to this board and currently active
    const content = await ScheduledContent.find({
      assignedBoards: boardId,
      isActive: true
    }).sort({ priority: -1, createdAt: -1 });

    // Filter content based on schedule
    const activeContent = content.filter(item => {
      switch (item.schedule.type) {
        case 'always':
          return true;

        case 'fixed':
          return currentTime >= item.schedule.startTime &&
                 currentTime <= item.schedule.endTime;

        case 'recurring':
          const isCorrectDay = item.schedule.daysOfWeek?.includes(currentDay);
          const isCorrectTime = currentTime >= item.schedule.startTime &&
                               currentTime <= item.schedule.endTime;
          return isCorrectDay && isCorrectTime;

        default:
          return false;
      }
    });

    // Update play count and last played for displayed content
    if (activeContent.length > 0) {
      await ScheduledContent.updateMany(
        { _id: { $in: activeContent.map(c => c._id) } },
        {
          $inc: { playCount: 1 },
          $set: { lastPlayed: now }
        }
      );
    }

    res.json({
      success: true,
      content: activeContent,
      currentTime,
      currentDay
    });

  } catch (error) {
    console.error('Error fetching active content for board:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active content',
      error: error.message
    });
  }
};

// Update scheduled content
const updateScheduledContent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const content = await ScheduledContent.findById(id);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled content not found'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'title', 'content', 'type', 'priority', 'duration',
      'schedule', 'assignedBoards', 'isActive'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        content[field] = updates[field];
      }
    });

    await content.save();
    await content.populate('assignedBoards', 'name location');
    await content.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Scheduled content updated successfully',
      content
    });

  } catch (error) {
    console.error('Error updating scheduled content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scheduled content',
      error: error.message
    });
  }
};

// Delete scheduled content
const deleteScheduledContent = async (req, res) => {
  try {
    const { id } = req.params;

    const content = await ScheduledContent.findById(id);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled content not found'
      });
    }

    await content.deleteOne();

    res.json({
      success: true,
      message: 'Scheduled content deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting scheduled content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scheduled content',
      error: error.message
    });
  }
};

// Import scheduled content from CSV/Excel
const importScheduledContent = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    let data = [];

    // Parse file based on extension
    if (fileExt === '.csv') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file format'
      });
    }

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'File contains no data'
      });
    }

    // Get all available boards for validation
    const allBoards = await Board.find({}, '_id name location');
    const boardMap = new Map(allBoards.map(board => [board.name.toLowerCase(), board._id.toString()]));

    const errors = [];
    const validContent = [];
    const processedRows = new Set();

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and we skip header

      // Skip duplicate rows (basic deduplication by title + content)
      const rowKey = `${row.title || ''}-${row.content || ''}`.toLowerCase();
      if (processedRows.has(rowKey)) {
        continue;
      }
      processedRows.add(rowKey);

      try {
        // Validate required fields
        if (!row.title || !row.content) {
          errors.push(`Row ${rowNum}: Missing required fields (title or content)`);
          continue;
        }

        // Parse and validate board assignments
        let assignedBoards = [];
        if (row.assigned_boards) {
          const boardNames = row.assigned_boards.toString().split(',').map(name => name.trim());
          assignedBoards = boardNames
            .map(name => boardMap.get(name.toLowerCase()))
            .filter(id => id); // Remove undefined values

          if (assignedBoards.length === 0) {
            errors.push(`Row ${rowNum}: No valid boards found for "${row.assigned_boards}"`);
            continue;
          }
        } else {
          errors.push(`Row ${rowNum}: No boards assigned`);
          continue;
        }

        // Parse schedule information
        const schedule = {
          type: row.schedule_type || 'recurring',
          startTime: row.start_time || '09:00',
          endTime: row.end_time || '17:00',
          daysOfWeek: row.days_of_week ? row.days_of_week.toString().split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [1, 2, 3, 4, 5],
          frequency: row.frequency || 'daily',
          startDate: row.start_date || '',
          endDate: row.end_date || '',
          exceptions: row.exceptions ? row.exceptions.toString().split(',').map(d => d.trim()).filter(d => d) : [],
          timeSlots: [{ start: row.start_time || '09:00', end: row.end_time || '17:00' }],
          playlist: []
        };

        // Validate schedule type
        if (!['fixed', 'recurring', 'always'].includes(schedule.type)) {
          errors.push(`Row ${rowNum}: Invalid schedule type "${schedule.type}"`);
          continue;
        }

        // Create content object
        const contentData = {
          title: row.title.toString().trim(),
          content: row.content.toString().trim(),
          type: ['default', 'user', 'emergency'].includes(row.type) ? row.type : 'user',
          priority: Math.min(Math.max(parseInt(row.priority) || 1, 1), 10),
          duration: Math.min(Math.max(parseInt(row.duration) || 60, 5), 3600),
          schedule,
          assignedBoards,
          createdBy: req.user.id,
          isActive: row.is_active !== undefined ? row.is_active === 'true' || row.is_active === true : true
        };

        validContent.push(contentData);

      } catch (error) {
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    if (validContent.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid content found to import',
        errors
      });
    }

    // Insert valid content in batches
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < validContent.length; i += batchSize) {
      const batch = validContent.slice(i, i + batchSize);
      await ScheduledContent.insertMany(batch);
      imported += batch.length;
    }

    res.json({
      success: true,
      message: `Successfully imported ${imported} content items`,
      imported,
      errors: errors.length > 0 ? errors : undefined,
      totalRows: data.length,
      validRows: validContent.length
    });

  } catch (error) {
    console.error('Error importing scheduled content:', error);

    // Clean up uploaded file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to import scheduled content',
      error: error.message
    });
  }
};

// Upload media files for content
const uploadMediaFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedFiles = [];
    const errors = [];

    // Ensure media directory exists
    const mediaDir = path.join(__dirname, '../uploads/media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    for (const file of req.files) {
      try {
        const fileExt = path.extname(file.originalname).toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${fileExt}`;
        const filePath = path.join(mediaDir, fileName);

        // Move file to permanent location
        fs.renameSync(file.path, filePath);

        // Determine file type
        let fileType = 'document';
        if (file.mimetype.startsWith('image/')) fileType = 'image';
        else if (file.mimetype.startsWith('video/')) fileType = 'video';
        else if (file.mimetype.startsWith('audio/')) fileType = 'audio';

        // Generate thumbnail for images
        let thumbnail = null;
        if (fileType === 'image') {
          try {
            const thumbnailName = `thumb-${fileName}`;
            const thumbnailPath = path.join(mediaDir, thumbnailName);
            await sharp(filePath)
              .resize(300, 300, { fit: 'cover' })
              .jpeg({ quality: 80 })
              .toFile(thumbnailPath);
            thumbnail = `/uploads/media/${thumbnailName}`;
          } catch (thumbError) {
            console.warn('Failed to generate thumbnail:', thumbError);
          }
        }

        // Get file metadata
        const stats = fs.statSync(filePath);
        const metadata = {
          size: stats.size,
          uploadedAt: new Date(),
          mimeType: file.mimetype
        };

        // Add video/image specific metadata
        if (fileType === 'image') {
          try {
            const imageInfo = await sharp(filePath).metadata();
            metadata.width = imageInfo.width;
            metadata.height = imageInfo.height;
            metadata.format = imageInfo.format;
          } catch (metaError) {
            console.warn('Failed to get image metadata:', metaError);
          }
        }

        uploadedFiles.push({
          type: fileType,
          filename: fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: stats.size,
          url: `/uploads/media/${fileName}`,
          path: filePath,
          thumbnail,
          metadata
        });

      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        errors.push({
          file: file.originalname,
          error: fileError.message
        });

        // Clean up failed file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedFiles.length} media files`,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error uploading media files:', error);

    // Clean up any uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload media files',
      error: error.message
    });
  }
};

// Get uploaded media files
const getUploadedMedia = async (req, res) => {
  try {
    const mediaDir = path.join(__dirname, '../uploads/media');

    if (!fs.existsSync(mediaDir)) {
      return res.json({
        success: true,
        media: []
      });
    }

    const files = fs.readdirSync(mediaDir);
    const mediaFiles = [];

    for (const file of files) {
      // Skip thumbnail files (they start with 'thumb-')
      if (file.startsWith('thumb-')) continue;

      try {
        const filePath = path.join(mediaDir, file);
        const stats = fs.statSync(filePath);

        // Determine file type from extension
        const ext = path.extname(file).toLowerCase();
        let fileType = 'document';
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) fileType = 'image';
        else if (['.mp4', '.avi', '.mov', '.wmv'].includes(ext)) fileType = 'video';
        else if (['.mp3', '.wav', '.m4a'].includes(ext)) fileType = 'audio';

        // Check for thumbnail
        const thumbnailName = `thumb-${file}`;
        const thumbnailPath = path.join(mediaDir, thumbnailName);
        const thumbnail = fs.existsSync(thumbnailPath) ? `/uploads/media/${thumbnailName}` : null;

        mediaFiles.push({
          type: fileType,
          filename: file,
          originalName: file, // We don't have the original name stored, so use filename
          url: `/uploads/media/${file}`,
          thumbnail,
          size: stats.size,
          uploadedAt: stats.mtime
        });

      } catch (error) {
        console.warn(`Error processing media file ${file}:`, error);
        // Continue with other files
      }
    }

    // Sort by upload date (newest first)
    mediaFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({
      success: true,
      media: mediaFiles
    });

  } catch (error) {
    console.error('Error fetching uploaded media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch uploaded media',
      error: error.message
    });
  }
};

module.exports = {
  createScheduledContent,
  getScheduledContent,
  updateScheduledContent,
  deleteScheduledContent,
  getActiveContentForBoard,
  importScheduledContent,
  uploadMediaFiles,
  getUploadedMedia
};