# Limited Control System Documentation

## Overview

The AutoVolt system implements a comprehensive limited control framework that allows administrators to grant granular, restricted access to devices. This system is designed to provide secure, controlled access while maintaining user safety and system integrity.

## Architecture

### 1. Permission Layers

The system operates on multiple permission layers:

```
User Role → Access Level → Device Permission → Time Restrictions → Usage Limits
```

### 2. Access Levels

- **Full**: Complete system access (admins only)
- **Limited**: Restricted access with specific permissions
- **Readonly**: View-only access, no control capabilities

## Device Permissions

### Basic Control Permissions

| Permission | Description | Default for Students | Default for Faculty |
|------------|-------------|---------------------|-------------------|
| `canTurnOn` | Can activate devices | ✅ | ✅ |
| `canTurnOff` | Can deactivate devices | ✅ | ✅ |
| `canViewStatus` | Can view device status | ✅ | ✅ |
| `canSchedule` | Can create schedules | ❌ | ✅ |
| `canModifySettings` | Can change device settings | ❌ | ✅ |
| `canViewHistory` | Can view usage history | ❌ | ✅ |

### Device-Specific Permissions

| Permission | Applies To | Description |
|------------|------------|-------------|
| `canAdjustBrightness` | Lights | Control brightness levels |
| `canAdjustSpeed` | Fans | Control fan speed |
| `canChangeInput` | Projectors | Switch input sources |
| `canConfigurePir` | All devices | Configure PIR sensor settings |
| `canViewPirData` | All devices | View PIR sensor data |
| `canDisablePir` | All devices | Disable PIR sensors |

## Restriction Types

### 1. Usage Limits

```javascript
{
  maxUsesPerDay: 10,        // Maximum operations per day
  usageToday: 3,            // Current usage count
  lastUsageReset: "2025-09-08T00:00:00.000Z"
}
```

### 2. Time-Based Restrictions

```javascript
{
  allowedTimeSlots: [{
    startTime: "08:00",     // 24-hour format
    endTime: "18:00",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
  }]
}
```

### 3. Value Limits

```javascript
{
  maxBrightnessLevel: 60,   // Maximum 60% brightness
  maxFanSpeed: 50,          // Maximum 50% fan speed
  allowedInputSources: ["HDMI1", "VGA"]  // Restricted input sources
}
```

### 4. Temporary Overrides

Administrators can grant temporary overrides that bypass all restrictions:

```javascript
{
  enabled: true,
  expiresAt: "2025-09-08T15:00:00.000Z",
  reason: "Emergency maintenance",
  grantedBy: "admin_user_id"
}
```

## Implementation Examples

### 1. Grant Basic Student Access

```javascript
POST /api/device-permissions/grant
{
  "userId": "student123",
  "deviceId": "device456",
  "permissions": {
    "canTurnOn": true,
    "canTurnOff": true,
    "canViewStatus": true,
    "canSchedule": false,
    "canModifySettings": false,
    "canConfigurePir": false
  },
  "restrictions": {
    "maxUsesPerDay": 5,
    "maxBrightnessLevel": 60,
    "allowedTimeSlots": [{
      "startTime": "08:00",
      "endTime": "17:00",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
    }]
  },
  "reason": "Basic facility access"
}
```

### 2. Grant Faculty Teaching Access

```javascript
POST /api/device-permissions/grant
{
  "userId": "faculty789",
  "deviceId": "device456",
  "permissions": {
    "canTurnOn": true,
    "canTurnOff": true,
    "canViewStatus": true,
    "canSchedule": true,
    "canModifySettings": true,
    "canAdjustBrightness": true,
    "canAdjustSpeed": true,
    "canConfigurePir": false
  },
  "restrictions": {
    "maxUsesPerDay": null,  // Unlimited
    "maxBrightnessLevel": 100,
    "maxFanSpeed": 100
  },
  "reason": "Teaching staff access"
}
```

### 3. Grant Maintenance Access

```javascript
POST /api/device-permissions/grant
{
  "userId": "maintenance001",
  "deviceId": "device456",
  "permissions": {
    "canTurnOn": true,
    "canTurnOff": true,
    "canViewStatus": true,
    "canModifySettings": false,
    "canConfigurePir": false,
    "canViewHistory": false
  },
  "restrictions": {
    "maxUsesPerDay": null
  },
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "reason": "Maintenance contract access"
}
```

## API Endpoints

### Device Permission Management

| Endpoint | Method | Description | Required Role |
|----------|--------|-------------|---------------|
| `/api/device-permissions/grant` | POST | Grant device permission | Admin, Principal, Dean, HOD, Faculty |
| `/api/device-permissions/user/:userId` | GET | Get user's permissions | Admin or User |
| `/api/device-permissions/:permissionId` | PUT | Update permission | Admin or Grantor |
| `/api/device-permissions/:permissionId` | DELETE | Revoke permission | Admin or Grantor |
| `/api/device-permissions/summary` | GET | Get all permissions | Admin, Principal |
| `/api/device-permissions/:permissionId/override` | POST | Temporary override | Admin only |

### Device Control with Permissions

| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|-------------------|
| `/api/devices/:deviceId/switches/:switchId/toggle` | POST | Toggle switch | `canTurnOn` or `canTurnOff` |
| `/api/devices/:deviceId/control` | POST | Control device settings | `canModifySettings` |
| `/api/devices/:deviceId/pir/configure` | POST | Configure PIR sensor | `canConfigurePir` |
| `/api/devices/:deviceId/status` | GET | View device status | `canViewStatus` |

## Error Codes

| Code | Description | HTTP Status | Solution |
|------|-------------|-------------|----------|
| `DEVICE_ACCESS_DENIED` | No permission for device | 403 | Grant device permission |
| `INSUFFICIENT_DEVICE_PERMISSION` | Missing specific permission | 403 | Update permission settings |
| `USAGE_LIMIT_EXCEEDED` | Daily usage limit reached | 429 | Wait until next day or grant override |
| `TIME_RESTRICTION` | Access outside allowed hours | 403 | Access during allowed time or grant override |
| `BRIGHTNESS_LIMIT_EXCEEDED` | Brightness value too high | 400 | Use value within limit |
| `SPEED_LIMIT_EXCEEDED` | Fan speed value too high | 400 | Use value within limit |
| `INPUT_SOURCE_RESTRICTED` | Input source not allowed | 400 | Use allowed input source |

## Frontend Components

### DevicePermissionManager

A comprehensive React component for managing device permissions:

```typescript
import DevicePermissionManager from '@/components/DevicePermissionManager';

// Usage in a page
function PermissionsPage() {
  return <DevicePermissionManager />;
}
```

Features:
- View all current permissions
- Grant new permissions with restrictions
- Update existing permissions
- Revoke permissions
- Grant temporary overrides
- Permission templates for common scenarios

## Security Considerations

### 1. Permission Inheritance

- Device permissions override user role permissions
- Admin role bypasses all device permissions
- Temporary overrides supersede all restrictions

### 2. Audit Logging

All permission changes are logged:
- Permission grants and revocations
- Temporary overrides
- Usage counter increments
- Failed access attempts

### 3. Time-Based Security

- Permissions can have expiration dates
- Time slots are checked in real-time
- Usage counters reset daily at midnight

### 4. Emergency Access

- Admin can always access any device
- Emergency override capability
- Security alerts for unusual access patterns

## Best Practices

### 1. Permission Granting

- Use principle of least privilege
- Set appropriate usage limits
- Define clear time restrictions
- Include descriptive reasons

### 2. Monitoring

- Regular review of granted permissions
- Monitor usage patterns
- Check for expired permissions
- Audit security logs

### 3. User Training

- Educate users on their permissions
- Provide clear feedback on restrictions
- Document common error scenarios
- Regular permission reviews

## Common Use Cases

### 1. Student Lab Access

```javascript
// Basic lab access for students
{
  permissions: {
    canTurnOn: true,
    canTurnOff: true,
    canViewStatus: true,
    canSchedule: false,
    canModifySettings: false
  },
  restrictions: {
    maxUsesPerDay: 10,
    allowedTimeSlots: [{
      startTime: "09:00",
      endTime: "17:00",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
    }]
  }
}
```

### 2. After-Hours Maintenance

```javascript
// Maintenance staff with extended hours
{
  permissions: {
    canTurnOn: true,
    canTurnOff: true,
    canModifySettings: true,
    canConfigurePir: true,
    canViewHistory: true
  },
  restrictions: {
    allowedTimeSlots: [{
      startTime: "18:00",
      endTime: "06:00",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    }]
  }
}
```

### 3. Guest Presenter

```javascript
// Temporary access for external presenters
{
  permissions: {
    canTurnOn: true,
    canTurnOff: true,
    canAdjustBrightness: true,
    canChangeInput: true
  },
  restrictions: {
    maxUsesPerDay: 20,
    maxBrightnessLevel: 80,
    allowedInputSources: ["HDMI1", "HDMI2", "VGA"]
  },
  expiresAt: "2025-09-10T18:00:00.000Z"
}
```

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check if user has required device permission
   - Verify time restrictions
   - Check usage limits

2. **Usage Limit Exceeded**
   - Review daily usage counter
   - Consider increasing limit or granting override
   - Check if counter reset properly

3. **Time Restriction Violations**
   - Verify current time against allowed slots
   - Check time zone settings
   - Consider granting bypass permission

### Debugging

Enable debug logging to trace permission checks:

```javascript
// In device permission middleware
console.log('Permission check:', {
  userId: req.user._id,
  deviceId: req.params.deviceId,
  requiredPermission,
  hasPermission: permission.permissions[requiredPermission],
  usageToday: permission.restrictions.usageToday,
  maxUses: permission.restrictions.maxUsesPerDay
});
```

## Conclusion

The limited control system provides a flexible and secure way to manage device access in educational environments. By combining role-based permissions with device-specific restrictions, administrators can create safe, controlled environments while maintaining necessary functionality for different user types.
