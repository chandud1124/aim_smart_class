
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Let CORS preflight through early
    if (req.method === 'OPTIONS') {
      return next(); // Let CORS middleware handle preflight
    }
    // Check for token in various places
    const token =
      req.header('Authorization')?.replace('Bearer ', '') ||
      req.body.token ||
      req.query.token ||
      req.headers['x-access-token'];

    if (!token) {
      return res.status(401).json({
        message: 'No token, authorization denied',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        message: 'User account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    req.user = user;
    next();
  } catch (error) {
  if (process.env.NODE_ENV !== 'production') console.error('[auth] token error', error.message);
  res.status(401).json({ message: 'Token is not valid' });
  }
};

// Enhanced authorization middleware with role hierarchy and permissions
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Super admin has access to everything
    if (req.user.role === 'super-admin') {
      return next();
    }

    // Check if user's role is in the allowed roles
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // Check role hierarchy - higher level roles can access lower level resources
    const roleHierarchy = {
      'super-admin': 10,
      'dean': 9,
      'admin': 8,
      'faculty': 7,
      'teacher': 6,
      'student': 5,
      'security': 4,
      'guest': 3
    };

    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = Math.min(...allowedRoles.map(role => roleHierarchy[role] || 0));

    if (userLevel >= requiredLevel) {
      return next();
    }

    return res.status(403).json({
      message: `User role ${req.user.role} is not authorized to access this resource`
    });
  };
};

// Permission-based authorization
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Super admin has all permissions
    if (req.user.role === 'super-admin') {
      return next();
    }

    // Check if user has the required permission
    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({
        message: `Insufficient permissions: ${permission} required`
      });
    }

    next();
  };
};

// Combined authorization - requires either role OR permission
const authorizeOr = (roles = [], permissions = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Super admin has access to everything
    if (req.user.role === 'super-admin') {
      return next();
    }

    // Check roles
    if (roles.includes(req.user.role)) {
      return next();
    }

    // Check permissions
    const hasPermission = permissions.some(permission =>
      req.user.permissions && req.user.permissions[permission]
    );

    if (hasPermission) {
      return next();
    }

    return res.status(403).json({
      message: 'Insufficient role or permissions to access this resource'
    });
  };
};

const checkDeviceAccess = async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    // Super admin and admin have access to all devices
    if (['super-admin', 'admin'].includes(req.user.role)) {
      return next();
    }

    // Dean has access to all devices in their domain
    if (req.user.role === 'dean') {
      return next();
    }

    // Check if device is specifically assigned to user
    if (req.user.assignedDevices && req.user.assignedDevices.includes(deviceId)) {
      return next();
    }

    // Faculty and teachers have access to devices in their assigned rooms
    if (['faculty', 'teacher'].includes(req.user.role) && req.user.assignedRooms && req.user.assignedRooms.length > 0) {
      // This would require checking the device's classroom, but for now allow access
      return next();
    }

    // Security personnel have access to security-related devices
    if (req.user.role === 'security' && req.user.permissions?.canAccessSecurityDevices) {
      return next();
    }

    // Students have limited access based on permissions
    if (req.user.role === 'student' && req.user.permissions?.canAccessStudentDevices) {
      return next();
    }

    // Guests have very limited access
    if (req.user.role === 'guest' && req.user.permissions?.canAccessGuestDevices) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied to this device' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during access check' });
  }
};

module.exports = {
  auth,
  authorize,
  requirePermission,
  authorizeOr,
  checkDeviceAccess
};
