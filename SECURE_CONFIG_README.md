# 🔐 Secure Configuration Management

This document explains how to set up and use the secure configuration management system for the IoT Smart Classroom project.

## Overview

The secure configuration system encrypts sensitive credentials and configuration values to prevent accidental exposure in version control or logs. It uses AES-256-GCM encryption with secure key management.

## Features

- **Encrypted Storage**: All sensitive configuration is encrypted before storage
- **Secure Key Management**: Encryption keys are protected with a master password
- **ESP32 Integration**: Automatically generates secure config headers for ESP32 firmware
- **Environment Variable Override**: Secure config values override environment variables
- **Validation**: Built-in integrity checking and validation

## Quick Start

### 1. Initial Setup

Run the secure configuration setup script:

```bash
# Linux/Mac
cd backend && ./setup-secure-config.sh

# Windows
cd backend && setup-secure-config.bat

# Or manually
cd backend && node scripts/secure-config.js setup
```

### 2. Follow the Interactive Prompts

The setup will ask for:
- JWT Secret (auto-generated if empty)
- MongoDB URI
- Email credentials
- ESP32 device configuration
- WiFi credentials

### 3. Update ESP32 Firmware

After setup, a `secure_config.h` file will be generated in the `esp32/` directory. Update your ESP32 firmware to include this file.

### 4. Restart Backend Server

The backend will automatically load secure configuration on startup.

## Manual Usage

### Setup Secure Configuration
```bash
node scripts/secure-config.js setup
```

### Load and Display Configuration
```bash
node scripts/secure-config.js load
```

### Update a Configuration Value
```bash
node scripts/secure-config.js update JWT_SECRET "new-secret-value"
```

### Get a Specific Value
```bash
node scripts/secure-config.js get MONGODB_URI
```

### List All Keys
```bash
node scripts/secure-config.js list
```

### Validate Configuration
```bash
node scripts/secure-config.js validate
```

## Configuration Keys

| Key | Description | Example |
|-----|-------------|---------|
| `JWT_SECRET` | JWT signing secret | `c8660e80e6f14c3bc9d7f1fc9a23af869fb9d21a6e9d82e4` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/iot_classroom` |
| `EMAIL_USERNAME` | SMTP username | `your-email@gmail.com` |
| `EMAIL_PASSWORD` | SMTP password | `your-app-password` |
| `ESP32_SECRET_KEY` | ESP32 device authentication key | `eb2930a2e8e3e5cee3743217ea321b1e3929f15ff8e27def` |
| `WIFI_SSID` | WiFi network name | `AIMS-WIFI` |
| `WIFI_PASSWORD` | WiFi password | `your-wifi-password` |
| `WEBSOCKET_HOST` | Backend server IP | `172.16.3.171` |
| `WEBSOCKET_PORT` | Backend server port | `3001` |

## Security Best Practices

### 1. Master Password
- Set a strong `CONFIG_MASTER_PASSWORD` environment variable
- Never commit the master password to version control
- Use different passwords for development and production

### 2. File Permissions
```bash
# Secure the configuration directory
chmod 700 backend/config/
chmod 600 backend/config/encrypted.env
chmod 600 backend/config/config.key
```

### 3. Environment Variables
```bash
# Set master password (never in code)
export CONFIG_MASTER_PASSWORD="your-very-secure-master-password"

# For production, use a key management service
export CONFIG_MASTER_PASSWORD="$(aws secretsmanager get-secret-value --secret-id config-master-password --query SecretString --output text)"
```

### 4. Git Ignore
The following files are automatically added to `.gitignore`:
- `backend/config/`
- `esp32/secure_config.h`
- `config.key`
- `encrypted.env`

## ESP32 Integration

### Automatic Generation
When you run the setup, a `secure_config.h` file is automatically generated:

```cpp
#ifndef SECURE_CONFIG_H
#define SECURE_CONFIG_H

// 🔐 SECURE CONFIGURATION - DO NOT COMMIT TO VERSION CONTROL
#define WIFI_SSID "AIMS-WIFI"
#define WIFI_PASSWORD "your-secure-password"
#define WEBSOCKET_HOST "172.16.3.171"
#define WEBSOCKET_PORT 3001
#define WEBSOCKET_PATH "/esp32-ws"
#define DEVICE_SECRET_KEY "eb2930a2e8e3e5cee3743217ea321b1e3929f15ff8e27def"

#endif // SECURE_CONFIG_H
```

### Manual Integration
1. Include the secure config in your ESP32 firmware:
```cpp
#include "secure_config.h"
```

2. Use the secure defines instead of hardcoded values:
```cpp
WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
webSocket.begin(WEBSOCKET_HOST, WEBSOCKET_PORT, WEBSOCKET_PATH);
```

## Troubleshooting

### Configuration Not Loading
```bash
# Check if secure config exists
ls -la backend/config/

# Validate configuration
node scripts/secure-config.js validate

# Check master password
echo $CONFIG_MASTER_PASSWORD
```

### ESP32 Connection Issues
```bash
# Regenerate ESP32 config
node scripts/secure-config.js setup

# Check generated file
cat esp32/secure_config.h
```

### Permission Errors
```bash
# Fix file permissions
chmod 600 backend/config/*
chmod 700 backend/config/
```

## Migration from .env

If you're migrating from a `.env` file:

1. Backup your current `.env` file
2. Run the secure setup
3. Manually transfer values from `.env` to secure config
4. Delete or rename the `.env` file
5. Test the application

## Production Deployment

### Docker Integration
```dockerfile
# In your Dockerfile
ENV CONFIG_MASTER_PASSWORD="your-production-master-password"
COPY backend/config/ ./config/
```

### Environment Variables
```bash
# Production environment
CONFIG_MASTER_PASSWORD="production-password"
NODE_ENV="production"
```

### Key Rotation
```bash
# To rotate encryption keys:
# 1. Backup current config
# 2. Delete backend/config/
# 3. Run setup again with new master password
# 4. Update CONFIG_MASTER_PASSWORD in production
```

## API Integration

The secure configuration is automatically loaded when the server starts. No additional API calls are needed.

## Support

For issues with secure configuration:
1. Check the validation output: `node scripts/secure-config.js validate`
2. Verify file permissions
3. Ensure CONFIG_MASTER_PASSWORD is set
4. Check logs for detailed error messages

## Security Audit

Regular security audits should include:
- Verification of encrypted files
- Key rotation procedures
- Access control to configuration files
- Master password complexity
- Backup security procedures