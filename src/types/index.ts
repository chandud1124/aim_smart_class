
export interface Device {
  id: string;
  name: string;
  macAddress: string;
  ipAddress: string;
  status: 'online' | 'offline';
  switches: Switch[];
  pirEnabled: boolean;
  pirGpio?: number;
  pirAutoOffDelay?: number;
  pirSensor?: PirSensor;
  lastSeen: Date;
  location?: string;
  classroom?: string;
  assignedUsers?: string[];
  aiEnabled?: boolean; // AI/ML control toggle
}

export interface Switch {
  id: string;
  name: string;
  // Primary GPIO used by backend model; keep optional to avoid breaking existing code paths
  gpio?: number;
  relayGpio: number;
  state: boolean;
  type: 'relay' | 'light' | 'fan' | 'outlet' | 'projector' | 'ac';
  icon?: string;
  manualSwitchEnabled: boolean;
  manualSwitchGpio?: number;
  manualMode?: 'maintained' | 'momentary';
  manualActiveLow?: boolean;
  usePir: boolean;
  schedule?: Schedule[];
  powerConsumption?: number;
  dontAutoOff?: boolean;
}

export interface PirSensor {
  id: string;
  name: string;
  gpio: number;
  isActive: boolean;
  triggered: boolean;
  sensitivity: number;
  timeout: number; // auto-off timeout in seconds
  linkedSwitches: string[]; // switch IDs
  schedule?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  type: 'daily' | 'weekly' | 'once';
  time: string;
  days?: number[]; // 0-6, Sunday to Saturday
  action: 'on' | 'off';
  duration?: number; // auto-off after X minutes
  checkHolidays?: boolean;
  respectMotion?: boolean;
  timeoutMinutes?: number;
  switches: Array<{ deviceId: string; switchId: string }>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'super-admin' | 'dean' | 'admin' | 'faculty' | 'teacher' | 'student' | 'security' | 'guest';
  roleLevel: number;
  department?: string;
  employeeId?: string;
  designation?: string;
  phone?: string;
  accessLevel: 'full' | 'limited' | 'readonly';
  isActive: boolean;
  isApproved: boolean;
  assignedDevices: string[];
  assignedRooms: string[];
  permissions: {
    canManageUsers: boolean;
    canApproveUsers: boolean;
    canManageDevices: boolean;
    canViewReports: boolean;
    canManageSchedule: boolean;
    canRequestExtensions: boolean;
    canApproveExtensions: boolean;
    canViewSecurityAlerts: boolean;
    canAccessAllClassrooms: boolean;
    canBypassTimeRestrictions: boolean;
    hasEmergencyAccess: boolean;
    hasDepartmentOverride: boolean;
    canAccessSecurityDevices: boolean;
    canAccessStudentDevices: boolean;
    canAccessGuestDevices: boolean;
    canDeleteUsers: boolean;
    canResetPasswords: boolean;
    canManageRoles: boolean;
    canViewAuditLogs: boolean;
    canManageSettings: boolean;
    canCreateSchedules: boolean;
    canModifySchedules: boolean;
    canOverrideSchedules: boolean;
    canViewAllSchedules: boolean;
    canSendNotifications: boolean;
    canReceiveAlerts: boolean;
    canManageAnnouncements: boolean;
  };
  lastLogin: Date;
  registrationDate: string;
  isOnline?: boolean;
  lastSeen?: Date;
}

export interface ActivityLog {
  id: string;
  deviceId: string;
  deviceName: string;
  switchId?: string;
  switchName?: string;
  action: 'on' | 'off' | 'toggle' | 'created' | 'updated' | 'deleted';
  triggeredBy: 'user' | 'schedule' | 'pir' | 'master' | 'system';
  userId?: string;
  userName?: string;
  location: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  duration?: number;
  powerConsumption?: number;
  conflictResolution?: {
    hasConflict: boolean;
    conflictType?: string;
    resolution?: string;
    responseTime?: number;
  } | string;
  deviceStatus?: {
    isOnline: boolean;
    responseTime?: number;
    signalStrength?: number;
  };
  isManualOverride?: boolean;
  metadata?: any;
}

export interface Holiday {
  id: string;
  name: string;
  date: Date;
  type: 'college' | 'national' | 'religious';
  createdBy?: string;
}

export interface DeviceConfig {
  switches: Array<{
    gpio: number;
    name: string;
    type: string;
    hasManualSwitch: boolean;
    manualSwitchGpio?: number;
    dontAutoOff?: boolean;
  }>;
  pirSensor?: {
    gpio: number;
    name: string;
    sensitivity: number;
    timeout: number;
  };
  updateInterval: number;
  otaEnabled: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DeviceStats {
  totalDevices: number;
  onlineDevices: number;
  totalSwitches: number;
  activeSwitches: number;
  totalPirSensors: number;
  activePirSensors: number;
}

// Notice Board Types
export interface Notice {
  _id: string;
  title: string;
  content?: string;
  type: 'text' | 'image' | 'video' | 'pdf';
  mediaUrl?: string;
  submittedBy: {
    _id: string;
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'active' | 'expired';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  approvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  approvedAt?: Date;
  rejectionReason?: string;
  tags: string[];
  targetAudience: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DisplayDevice {
  _id: string;
  deviceId: string;
  name: string;
  location?: string;
  capabilities: {
    supportsVideo: boolean;
    supportsImages: boolean;
    supportsPdf: boolean;
    screenResolution?: string;
    screenSize?: string;
  };
  status: 'online' | 'offline' | 'maintenance';
  currentContent?: string; // Notice ID currently displayed
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoticeSchedule {
  _id: string;
  notice: string | Notice;
  displayDevice: string | DisplayDevice;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  repeat: {
    type: 'none' | 'daily' | 'weekly' | 'monthly';
    daysOfWeek?: number[]; // 0-6, Sunday to Saturday
    endDate?: Date;
  };
  isActive: boolean;
  createdBy: {
    _id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NoticeSubmissionData {
  title: string;
  content?: string;
  type: 'text' | 'image' | 'video' | 'pdf';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  targetAudience?: string[];
  media?: File;
}

export interface NoticeApprovalData {
  status: 'approved' | 'rejected';
  rejectionReason?: string;
}

export interface NoticeScheduleData {
  displayDevice: string;
  startTime: Date;
  endTime: Date;
  duration?: number;
  repeat?: {
    type: 'none' | 'daily' | 'weekly' | 'monthly';
    daysOfWeek?: number[];
    endDate?: Date;
  };
}
