
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true // Index for email lookups
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['super-admin', 'dean', 'admin', 'faculty', 'teacher', 'student', 'security', 'guest'],
    default: 'student',
    index: true // Index for role-based queries
  },
  roleLevel: {
    type: Number,
    default: function() {
      const roleLevels = {
        'super-admin': 10,
        'dean': 9,
        'admin': 8,
        'faculty': 7,
        'teacher': 6,
        'security': 5,
        'student': 4,
        'guest': 3
      };
      return roleLevels[this.role] || 3;
    }
  },
  permissions: {
    canManageAdmins: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canConfigureDevices: { type: Boolean, default: false },
    canControlDevices: { type: Boolean, default: false },
    canViewAllReports: { type: Boolean, default: false },
    canViewAssignedReports: { type: Boolean, default: false },
    canApproveRequests: { type: Boolean, default: false },
    canScheduleAutomation: { type: Boolean, default: false },
    canRequestDeviceControl: { type: Boolean, default: false },
    canMonitorSecurity: { type: Boolean, default: false },
    canViewPublicDashboard: { type: Boolean, default: true },
    canApproveExtensions: { type: Boolean, default: false },
    canRequestExtensions: { type: Boolean, default: false },
    emergencyOverride: { type: Boolean, default: false }
  },
  department: {
    type: String,
    trim: true,
    index: true
  },
  class: {
    type: String,
    trim: true,
    index: true
  },
  employeeId: {
    type: String,
    trim: true,
    sparse: true // Allow null values but ensure uniqueness when present
  },
  phone: {
    type: String,
    trim: true
  },
  designation: {
    type: String,
    trim: true
  },
  accessLevel: {
    type: String,
    enum: ['full', 'limited', 'readonly'],
    default: 'limited'
  },
  assignedDevices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  assignedRooms: [{
    type: String,
    trim: true
  }],
  classroomPermissions: {
    canAccessAllClassrooms: { type: Boolean, default: false },
    departmentOverride: { type: Boolean, default: false },
    emergencyAccess: { type: Boolean, default: false },
    bypassTimeRestrictions: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: false, // Users need approval to become active
    index: true // Index for active user queries
  },
  isApproved: {
    type: Boolean,
    default: false,
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  lastLogin: {
    type: Date,
    default: Date.now,
    index: true // Index for login analytics
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  firstLoginResetRequired: {
    type: Boolean,
    default: false
  },
  canRequestExtensions: {
    type: Boolean,
    default: false // Only faculty can request extensions
  },
  canApproveExtensions: {
    type: Boolean,
    default: false // Admin, Dean, Faculty, Super Admin can approve
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: false } // Only security personnel
  },
  registrationReason: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  lastProfileUpdate: {
    type: Date
  },
  profilePicture: {
    type: String, // URL/path to profile picture
    default: null
  },
  isOnline: {
    type: Boolean,
    default: false,
    index: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function (next) {
  // Set permissions based on role
  const rolePermissions = {
    'super-admin': {
      canManageAdmins: true,
      canManageUsers: true,
      canConfigureDevices: true,
      canControlDevices: true,
      canViewAllReports: true,
      canViewAssignedReports: true,
      canApproveRequests: true,
      canScheduleAutomation: true,
      canRequestDeviceControl: true,
      canMonitorSecurity: true,
      canViewPublicDashboard: true,
      canApproveExtensions: true,
      canRequestExtensions: true,
      emergencyOverride: true
    },
    'dean': {
      canManageAdmins: false,
      canManageUsers: false,
      canConfigureDevices: false,
      canControlDevices: false,
      canViewAllReports: true,
      canViewAssignedReports: true,
      canApproveRequests: true,
      canScheduleAutomation: false,
      canRequestDeviceControl: false,
      canMonitorSecurity: true,
      canViewPublicDashboard: true,
      canApproveExtensions: true,
      canRequestExtensions: true,
      emergencyOverride: false
    },
    'admin': {
      canManageAdmins: false,
      canManageUsers: true,
      canConfigureDevices: true,
      canControlDevices: true,
      canViewAllReports: true,
      canViewAssignedReports: true,
      canApproveRequests: true,
      canScheduleAutomation: true,
      canRequestDeviceControl: true,
      canMonitorSecurity: false,
      canViewPublicDashboard: true,
      canApproveExtensions: true,
      canRequestExtensions: true,
      emergencyOverride: false
    },
    'faculty': {
      canManageAdmins: false,
      canManageUsers: false,
      canConfigureDevices: false,
      canControlDevices: true,
      canViewAllReports: false,
      canViewAssignedReports: true,
      canApproveRequests: true,
      canScheduleAutomation: true,
      canRequestDeviceControl: true,
      canMonitorSecurity: false,
      canViewPublicDashboard: true,
      canApproveExtensions: true,
      canRequestExtensions: true,
      emergencyOverride: false
    },
    'teacher': {
      canManageAdmins: false,
      canManageUsers: false,
      canConfigureDevices: false,
      canControlDevices: true,
      canViewAllReports: false,
      canViewAssignedReports: true,
      canApproveRequests: false,
      canScheduleAutomation: true,
      canRequestDeviceControl: true,
      canMonitorSecurity: false,
      canViewPublicDashboard: true,
      canApproveExtensions: true,
      canRequestExtensions: true,
      emergencyOverride: false
    },
    'student': {
      canManageAdmins: false,
      canManageUsers: false,
      canConfigureDevices: false,
      canControlDevices: false,
      canViewAllReports: false,
      canViewAssignedReports: false,
      canApproveRequests: false,
      canScheduleAutomation: false,
      canRequestDeviceControl: true,
      canMonitorSecurity: false,
      canViewPublicDashboard: true,
      canApproveExtensions: false,
      canRequestExtensions: true,
      emergencyOverride: false
    },
    'security': {
      canManageAdmins: false,
      canManageUsers: false,
      canConfigureDevices: false,
      canControlDevices: false,
      canViewAllReports: false,
      canViewAssignedReports: false,
      canApproveRequests: false,
      canScheduleAutomation: false,
      canRequestDeviceControl: false,
      canMonitorSecurity: true,
      canViewPublicDashboard: true,
      canApproveExtensions: false,
      canRequestExtensions: false,
      emergencyOverride: true
    },
    'guest': {
      canManageAdmins: false,
      canManageUsers: false,
      canConfigureDevices: false,
      canControlDevices: false,
      canViewAllReports: false,
      canViewAssignedReports: false,
      canApproveRequests: false,
      canScheduleAutomation: false,
      canRequestDeviceControl: false,
      canMonitorSecurity: false,
      canViewPublicDashboard: true,
      canApproveExtensions: false,
      canRequestExtensions: false,
      emergencyOverride: false
    }
  };

  // Set permissions based on role
  if (rolePermissions[this.role]) {
    this.permissions = { ...this.permissions, ...rolePermissions[this.role] };
  }

  // Set role level
  const roleLevels = {
    'super-admin': 10,
    'dean': 9,
    'admin': 8,
    'faculty': 7,
    'teacher': 6,
    'security': 5,
    'student': 4,
    'guest': 3
  };
  this.roleLevel = roleLevels[this.role] || 3;

  // Handle password hashing
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
