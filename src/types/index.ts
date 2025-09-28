
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
  deviceType?: 'esp32' | 'raspberry_pi'; // Device type for filtering
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

export interface Notice {
  _id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'general' | 'academic' | 'administrative' | 'event' | 'emergency' | 'maintenance';
  status: 'pending' | 'approved' | 'rejected' | 'published' | 'archived';
  submittedBy: {
    _id: string;
    name: string;
    email: string;
    role: string;
    department?: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  approvedAt?: Date;
  publishedAt?: Date;
  expiryDate?: Date;
  attachments: Array<{
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
    uploadedAt: Date;
  }>;
  targetAudience: {
    roles?: string[];
    departments?: string[];
    classes?: string[];
  };
  targetBoards?: Array<{
    boardId: string;
    assignedBy: string;
    priority: number;
    displayOrder: number;
  }>;
  displayDevices?: Array<{
    deviceId: string;
    displayedAt: Date;
    displayDuration: number;
  }>;
  viewCount: number;
  isActive: boolean;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  isExpired?: boolean;
  formattedExpiryDate?: string;
}

export interface NoticeSubmissionData {
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'general' | 'academic' | 'administrative' | 'event' | 'emergency' | 'maintenance';
  expiryDate?: string;
  targetAudience: {
    roles?: string[];
    departments?: string[];
    classes?: string[];
  };
  selectedBoards?: string[];
  attachments?: File[];
}

export interface NoticeReviewData {
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

export interface NoticeStats {
  total: number;
  pending: number;
  published: number;
  rejected: number;
  breakdown: Array<{
    _id: string;
    count: number;
  }>;
}

export interface NoticeFilters {
  status?: string;
  category?: string;
  priority?: string;
  submittedBy?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
