const express = require("express");
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { sendTempPasswordEmail, sendPasswordChangedEmail } = require('../services/emailService');
const crypto = require('crypto');
const {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} = require('../controllers/userController');

// All user routes require authentication
router.use(auth);

// Self-service routes BEFORE parameterized ObjectId routes to avoid conflicts
// PATCH /api/users/me/password - self-service password change (auth user)
router.patch('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
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

// GET /api/users/me/flags - return forced-reset flag
router.get('/me/flags', async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('firstLoginResetRequired');
    res.json({ firstLoginResetRequired: user ? user.firstLoginResetRequired : false });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching flags' });
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
router.patch('/:id(' + objectIdPattern + ')/password', authorize('admin'), async (req, res) => {
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
router.get('/online', authorize('admin'), async (req, res) => {
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

module.exports = router;
