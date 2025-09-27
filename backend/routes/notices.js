const express = require('express');
const multer = require('multer');
const path = require('path');
const { auth, authorize } = require('../middleware/auth');
const Notice = require('../models/Notice');
const Schedule = require('../models/Schedule');
const DisplayDevice = require('../models/DisplayDevice');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/notices/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Submit notice for approval
router.post('/submit', auth, upload.single('media'), async (req, res) => {
  try {
    const { title, content, type, priority, tags, targetAudience } = req.body;

    const notice = new Notice({
      title,
      content,
      type,
      mediaUrl: req.file ? req.file.path : null,
      submittedBy: req.user._id,
      priority: priority || 'medium',
      tags: tags ? JSON.parse(tags) : [],
      targetAudience: targetAudience ? JSON.parse(targetAudience) : []
    });

    await notice.save();

    // Notify admins via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('notice_submitted', {
        notice: notice._id,
        title: notice.title,
        submittedBy: req.user.name
      });
    }

    res.status(201).json({ message: 'Notice submitted for approval', notice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notices for user
router.get('/my-notices', auth, async (req, res) => {
  try {
    const notices = await Notice.find({ submittedBy: req.user._id })
      .sort({ createdAt: -1 });
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get pending notices
router.get('/pending', auth, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const notices = await Notice.find({ status: 'pending' })
      .populate('submittedBy', 'name email')
      .sort({ priority: -1, createdAt: 1 });
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Approve notice
router.put('/:id/approve', auth, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        approvedBy: req.user._id,
        approvedAt: new Date()
      },
      { new: true }
    );

    if (!notice) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    // Notify submitter
    const io = req.app.get('io');
    if (io) {
      io.emit('notice_approved', {
        notice: notice._id,
        title: notice.title,
        approvedBy: req.user.name
      });
    }

    res.json({ message: 'Notice approved', notice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Reject notice
router.put('/:id/reject', auth, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const { reason } = req.body;

    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        rejectionReason: reason,
        approvedBy: req.user._id,
        approvedAt: new Date()
      },
      { new: true }
    );

    if (!notice) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    res.json({ message: 'Notice rejected', notice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get all notices
router.get('/all', auth, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = status ? { status } : {};

    const notices = await Notice.find(query)
      .populate('submittedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notice.countDocuments(query);

    res.json({
      notices,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create schedule for approved notice
router.post('/:id/schedule', auth, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const { displayDevice, startTime, endTime, duration, repeat } = req.body;

    const notice = await Notice.findById(req.params.id);
    if (!notice || notice.status !== 'approved') {
      return res.status(400).json({ error: 'Notice must be approved first' });
    }

    const schedule = new Schedule({
      notice: req.params.id,
      displayDevice,
      startTime,
      endTime,
      duration: duration || 30,
      repeat: repeat || { type: 'none' },
      createdBy: req.user._id
    });

    await schedule.save();

    // Update notice status
    await Notice.findByIdAndUpdate(req.params.id, { status: 'scheduled' });

    // Notify display device
    const io = req.app.get('io');
    if (io) {
      io.emit('schedule_updated', { deviceId: displayDevice });
    }

    res.status(201).json({ message: 'Schedule created', schedule });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get schedules for device
router.get('/device/:deviceId/schedules', async (req, res) => {
  try {
    const schedules = await Schedule.find({
      displayDevice: req.params.deviceId,
      isActive: true,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() }
    }).populate('notice');

    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register display device
router.post('/devices/register', async (req, res) => {
  try {
    const { deviceId, name, location, capabilities } = req.body;

    const device = await DisplayDevice.findOneAndUpdate(
      { deviceId },
      {
        name,
        location,
        capabilities,
        status: 'online',
        lastSeen: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Device registered', device });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all display devices
router.get('/devices', auth, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const devices = await DisplayDevice.find().sort({ lastSeen: -1 });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set default notice for device
router.put('/devices/:deviceId/default', auth, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const { noticeId } = req.body;

    const device = await DisplayDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      {
        currentContent: noticeId,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Notify device to update default content
    const io = req.app.get('io');
    if (io) {
      io.emit('default_content_updated', {
        deviceId: req.params.deviceId,
        noticeId
      });
    }

    res.json({ message: 'Default content updated', device });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;