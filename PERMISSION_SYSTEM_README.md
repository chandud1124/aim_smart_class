# 🔐 Role-Based Permission System

This document explains the comprehensive role-based permission system implemented for the IoT Smart Classroom project.

## Overview

The permission system provides fine-grained access control for device operations, allowing administrators to define exactly what each user can do with classroom devices. It supports role-based permissions, device-specific permissions, usage limits, time restrictions, and temporary overrides.

## Key Features

- **Role-Based Access Control**: Different permission levels for different user roles
- **Device-Specific Permissions**: Granular control over individual devices
- **Usage Limits**: Daily usage limits and time-based restrictions
- **Temporary Overrides**: Admin can grant temporary elevated permissions
- **Audit Logging**: All permission checks and usage are logged
- **Flexible Restrictions**: Brightness limits, fan speed limits, input source restrictions

## Permission Types

### Basic Permissions
- `canTurnOn`: Allow turning devices on
- `canTurnOff`: Allow turning devices off
- `canViewStatus`: Allow viewing device status
- `canSchedule`: Allow scheduling device operations
- `canModifySettings`: Allow changing device settings
- `canViewHistory`: Allow viewing device usage history

### Advanced Permissions
- `canAdjustBrightness`: Allow adjusting light brightness
- `canAdjustSpeed`: Allow adjusting fan speed
- `canChangeInput`: Allow changing projector input sources
- `canConfigurePir`: Allow configuring PIR motion sensors
- `canViewPirData`: Allow viewing PIR sensor data
- `canDisablePir`: Allow disabling PIR sensors

## User Roles & Default Permissions

### Student
```javascript
{
    canTurnOn: true,
    canTurnOff: true,
    canViewStatus: true,
    canSchedule: false,
    canModifySettings: false,
    canViewHistory: false,
    canAdjustBrightness: false,
    canAdjustSpeed: false,
    canChangeInput: false,
    canConfigurePir: false,
    canViewPirData: true,
    canDisablePir: false
}
```
**Restrictions:**
- Max 5 uses per day
- Max brightness: 60%
- Max fan speed: 50%
- Time: 8:00 AM - 5:00 PM, weekdays only

### Faculty
```javascript
{
    canTurnOn: true,
    canTurnOff: true,
    canViewStatus: true,
    canSchedule: true,
    canModifySettings: true,
    canViewHistory: true,
    canAdjustBrightness: true,
    canAdjustSpeed: true,
    canChangeInput: false,
    canConfigurePir: false,
    canViewPirData: true,
    canDisablePir: false
}
```
**Restrictions:**
- Unlimited daily usage
- Full brightness/speed control
- No time restrictions

### HOD (Head of Department)
```javascript
{
    canTurnOn: true,
    canTurnOff: true,
    canViewStatus: true,
    canSchedule: true,
    canModifySettings: true,
    canViewHistory: true,
    canAdjustBrightness: true,
    canAdjustSpeed: true,
    canChangeInput: true,
    canConfigurePir: true,
    canViewPirData: true,
    canDisablePir: true
}
```
**Restrictions:**
- Unlimited daily usage
- Full control over all settings
- Access to HDMI1, HDMI2, VGA, DisplayPort inputs

### Dean
```javascript
{
    // Same as HOD but with additional input sources
    canChangeInput: true, // Includes USB-C
}
```

### Security
```javascript
{
    canTurnOn: false,
    canTurnOff: false,
    canViewStatus: true,
    canSchedule: false,
    canModifySettings: false,
    canViewHistory: true,
    canAdjustBrightness: false,
    canAdjustSpeed: false,
    canChangeInput: false,
    canConfigurePir: true,
    canViewPirData: true,
    canDisablePir: false
}
```
**Restrictions:**
- View-only access
- Can monitor PIR sensors but not control devices

## Setup Instructions

### 1. Initial Setup
```bash
cd backend
node scripts/setup-permissions.js setup
```

This will:
- Create default permissions for all users based on their roles
- Assign device access based on departments and assigned rooms
- Set up appropriate restrictions for each role

### 2. Custom Permissions
```bash
node scripts/setup-permissions.js custom <userId> <deviceId> '{"canTurnOn":true}' '{"maxUsesPerDay":10}'
```

### 3. List User Permissions
```bash
node scripts/setup-permissions.js list <userId>
```

## API Usage

### Grant Device Permission
```javascript
POST /api/device-permissions/grant
{
    "userId": "user_id",
    "deviceId": "device_id",
    "permissions": {
        "canTurnOn": true,
        "canTurnOff": true,
        "canViewStatus": true
    },
    "restrictions": {
        "maxUsesPerDay": 5,
        "maxBrightnessLevel": 60
    },
    "reason": "Limited student access"
}
```

### Update Permission
```javascript
PUT /api/device-permissions/:permissionId
{
    "permissions": { "canSchedule": true },
    "restrictions": { "maxUsesPerDay": 10 }
}
```

### Temporary Override
```javascript
POST /api/device-permissions/:permissionId/override
{
    "durationMinutes": 60,
    "reason": "Exam preparation"
}
```

## Device Access Control

### Automatic Permission Checking
The system automatically checks permissions for device operations:

```javascript
// This route requires canTurnOn permission
router.post('/:deviceId/switches/:switchId/toggle',
    checkDevicePermission('canTurnOn'),
    incrementUsage,
    toggleSwitch
);
```

### Permission Enforcement Flow
1. **Authentication**: User must be logged in
2. **Role Check**: Admin bypasses all checks
3. **Device Access**: Check if user has access to device
4. **Permission Check**: Verify specific permission for action
5. **Usage Limits**: Check daily usage limits
6. **Time Restrictions**: Verify time-based access
7. **Value Limits**: Check brightness/speed/input restrictions
8. **Usage Tracking**: Increment usage counter
9. **Audit Logging**: Log all permission checks

## Usage Limits & Restrictions

### Daily Usage Limits
```javascript
restrictions: {
    maxUsesPerDay: 5,  // Limit to 5 operations per day
    usageToday: 0,     // Current usage (auto-reset daily)
    lastUsageReset: new Date()
}
```

### Time-Based Restrictions
```javascript
restrictions: {
    allowedTimeSlots: [{
        startTime: "08:00",
        endTime: "17:00",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
    }]
}
```

### Value Restrictions
```javascript
restrictions: {
    maxBrightnessLevel: 60,     // Max 60% brightness
    maxFanSpeed: 50,           // Max 50% fan speed
    allowedInputSources: ["HDMI1", "HDMI2"]  // Only these inputs
}
```

## Temporary Overrides

Administrators can grant temporary elevated permissions:

```javascript
// Grant 1-hour override
POST /api/device-permissions/:permissionId/override
{
    "durationMinutes": 60,
    "reason": "Guest lecturer access"
}
```

## Audit & Monitoring

### Permission Audit Logs
All permission checks are logged:
```javascript
logger.info(`Permission granted: ${user.name} -> ${device.name}`, {
    userId,
    deviceId,
    action: 'toggle',
    permissions: grantedPermissions
});
```

### Usage Tracking
Device usage is tracked and can be monitored:
```javascript
logger.info(`Device usage: ${user.name} used ${device.name}`, {
    userId,
    deviceId,
    usageCount: currentUsage,
    dailyLimit: maxUses
});
```

## Error Codes

### Permission Errors
- `NO_DEVICE_PERMISSION`: User has no permission for device
- `INSUFFICIENT_PERMISSIONS`: Missing specific permission
- `USAGE_LIMIT_EXCEEDED`: Daily usage limit reached
- `TIME_RESTRICTION`: Access not allowed at current time
- `BRIGHTNESS_LIMIT_EXCEEDED`: Brightness exceeds allowed limit
- `SPEED_LIMIT_EXCEEDED`: Fan speed exceeds allowed limit
- `INPUT_SOURCE_NOT_ALLOWED`: Input source not in allowed list

## Best Practices

### 1. Principle of Least Privilege
- Grant minimum permissions required for user's role
- Use restrictions to limit access scope
- Regularly review and update permissions

### 2. Time-Based Access
- Use time restrictions for student access during school hours
- Allow faculty 24/7 access for preparation
- Restrict maintenance access to off-hours

### 3. Usage Monitoring
- Set reasonable daily limits to prevent abuse
- Monitor usage patterns for anomalies
- Use audit logs for security investigations

### 4. Temporary Overrides
- Use temporary overrides sparingly
- Always provide reason for override
- Set appropriate duration limits
- Monitor override usage

## Troubleshooting

### Permission Denied Errors
1. Check user's role and assigned permissions
2. Verify device access rights
3. Check time restrictions and usage limits
4. Review audit logs for permission checks

### Usage Limit Issues
1. Check daily usage counter
2. Verify reset timing (daily at midnight)
3. Review permission restrictions
4. Consider increasing limits if appropriate

### Time Restriction Problems
1. Check server time zone settings
2. Verify allowed time slots configuration
3. Test with different days/times
4. Check for daylight saving time issues

## Integration with Frontend

The permission system integrates with the frontend through:

1. **User Context**: User permissions loaded on login
2. **Device Controls**: UI elements enabled/disabled based on permissions
3. **Error Handling**: User-friendly error messages for permission failures
4. **Real-time Updates**: Permission changes reflected immediately

## Security Considerations

1. **Permission Validation**: All permissions validated on server-side
2. **Audit Logging**: All access attempts logged for security
3. **Session Management**: Permissions checked on every request
4. **Override Tracking**: Temporary overrides monitored and logged
5. **Regular Reviews**: Periodic review of user permissions

## Future Enhancements

- **Group Permissions**: Permission inheritance from groups
- **Dynamic Permissions**: Context-aware permission evaluation
- **Permission Templates**: Predefined permission sets
- **Advanced Scheduling**: Time-based permission changes
- **Integration APIs**: Third-party permission management