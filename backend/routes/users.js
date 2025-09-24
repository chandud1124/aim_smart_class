const express = require("express");
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { sendTempPasswordEmail, sendPasswordChangedEmail } = require('../services/emailService');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { handleValidationErrors } = require('../middleware/validationHandler');
const { body } = require('express-validator');
const {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  bulkActivateUsers,
  bulkDeactivateUsers,
  bulkDeleteUsers,
  bulkAssignRole
} = require('../controllers/userController');

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with user ID
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed!'));
    }
  }
});

// All user routes require authentication
router.use(auth);

// Self-service routes BEFORE parameterized ObjectId routes to avoid conflicts
// PATCH /api/users/me/password - self-service password change (auth user)
router.patch('/me/password', 
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
  ],
  handleValidationErrors,
  async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const match = await user.matchPassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password incorrect' });
    user.password = newPassword;
    user.firstLoginResetRequired = false;
    await user.save();
    sendPasswordChangedEmail(user.email).catch(() => { });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password' });
  }
});

// PATCH /api/users/me/profile-picture - upload profile picture
router.patch('/me/profile-picture', (req, res, next) => {
  upload.single('profilePicture')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }
    } else if (err) {
      // An unknown error occurred
      return res.status(400).json({ message: err.message || 'Invalid file type. Only JPEG, PNG, and GIF are allowed.' });
    }
    // Everything went fine, proceed to the actual handler
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      const oldPath = path.join(__dirname, '../uploads/profiles', path.basename(user.profilePicture));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update user with new profile picture path
    const profilePictureUrl = `/uploads/profiles/${req.file.filename}`;
    user.profilePicture = profilePictureUrl;
    user.lastProfileUpdate = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: profilePictureUrl
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ message: 'Error uploading profile picture' });
  }
});

// DELETE /api/users/me/profile-picture - delete profile picture
router.delete('/me/profile-picture', async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.profilePicture) {
      const filePath = path.join(__dirname, '../uploads/profiles', path.basename(user.profilePicture));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    user.profilePicture = null;
    user.lastProfileUpdate = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture removed successfully'
    });
  } catch (error) {
    console.error('Profile picture delete error:', error);
    res.status(500).json({ message: 'Error removing profile picture' });
  }
});

// GET /api/users - list users with optional pagination & search
router.get('/', getAllUsers);

// POST /api/users - create a new user
router.post('/', createUser);

const objectIdPattern = '([0-9a-fA-F]{24})';

// GET single user
router.get('/:id(' + objectIdPattern + ')', getUser);

// PUT /api/users/:id - replace/update user
router.put('/:id(' + objectIdPattern + ')', updateUser);

// PATCH /api/users/:id/status - toggle active status
router.patch('/:id(' + objectIdPattern + ')/status', toggleUserStatus);

// POST fallback for status toggle (some environments block PATCH)
router.post('/:id(' + objectIdPattern + ')/status', toggleUserStatus);

// DELETE /api/users/:id - delete user
router.delete('/:id(' + objectIdPattern + ')', deleteUser);

// PATCH /api/users/:id/password - admin sets/resets a user's password
router.patch('/:id(' + objectIdPattern + ')/password', authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const User = require('../models/User');
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = password; // pre-save hook will hash
    user.firstLoginResetRequired = false;
    await user.save();
    sendPasswordChangedEmail(user.email).catch(() => { });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error updating password' });
  }
});

// GET /api/users/online - get list of online users (admin only)
router.get('/online', authorize('admin', 'super-admin'), async (req, res) => {
  try {
    // Get socket service instance from the app
    const io = req.app.get('io');
    if (!io || !io.socketService) {
      return res.status(500).json({ message: 'Socket service not available' });
    }

    const onlineUsers = await io.socketService.getOnlineUsers();
    res.json({
      success: true,
      data: onlineUsers
    });
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ message: 'Error fetching online users' });
  }
});

// Bulk operations routes
// POST /api/users/bulk/activate - bulk activate users
router.post('/bulk/activate', authorize('admin', 'super-admin'), bulkActivateUsers);

// POST /api/users/bulk/deactivate - bulk deactivate users
router.post('/bulk/deactivate', authorize('admin', 'super-admin'), bulkDeactivateUsers);

// POST /api/users/bulk/delete - bulk delete users
router.post('/bulk/delete', authorize('admin', 'super-admin'), bulkDeleteUsers);

// POST /api/users/bulk/assign-role - bulk assign role to users
router.post('/bulk/assign-role', authorize('admin', 'super-admin'), bulkAssignRole);

module.exports = router;
