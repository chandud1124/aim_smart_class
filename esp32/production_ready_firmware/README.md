# ESP32 Production Ready Firmware - Arduino IDE Project

## Overview
This Arduino IDE project contains the complete production-ready firmware for ESP32 classroom automation devices. The firmware includes secure configuration, crash prevention, manual switch logging, and night time protection.

## Features
- ✅ **Secure Configuration**: No hardcoded credentials, multiple setup methods
- ✅ **Crash Prevention**: Watchdog timer, memory monitoring, safe operations
- ✅ **Manual Switch Logging**: All manual operations logged to backend
- ✅ **Night Protection**: ON commands deferred during night hours (10PM-6AM)
- ✅ **Offline Operation**: Works without WiFi/backend connection
- ✅ **Minimal Memory**: Optimized for ESP32 constraints

## Files Included
- `production_ready_firmware.ino` - Main Arduino sketch
- `config.h` - Configuration constants
- `secure_config.h/cpp` - Secure configuration management
- `ws_manager.h` - WebSocket connection management
- `safe_string.h` - Safe string operations
- `rate_limiter.h` - Command rate limiting
- `log.h` - Logging system
- `memutils.h/cpp` - Memory management utilities

## Arduino IDE Setup
1. Open Arduino IDE
2. Go to File → Open → Select this folder
3. Choose `production_ready_firmware.ino`
4. Install required libraries:
   - WebSockets by Markus Sattler
   - ArduinoJson by Benoit Blanchon
5. Select your ESP32 board in Tools → Board
6. Set the correct COM port in Tools → Port
7. Click Upload

## Configuration
After uploading, the ESP32 will enter configuration mode. You can configure:
- WiFi credentials
- Backend server details
- Device identification

## Backend Integration
The firmware communicates with the backend via WebSocket:
- **Port**: 3001 (configurable)
- **Path**: /esp32-ws
- **Messages**: JSON format for commands and status updates

## Manual Switch Logging
All manual switch operations are automatically detected and logged to the backend with:
- GPIO pin number
- Action (ON/OFF)
- Timestamp
- Physical pin information
- HMAC signature for security

## Night Time Protection
During night hours (10PM to 6AM), ON commands are deferred and executed automatically when daytime returns.

## Troubleshooting
- Check Serial Monitor (115200 baud) for debug information
- Ensure all required libraries are installed
- Verify WiFi and backend connectivity
- Check ESP32 board selection in Arduino IDE

## Production Notes
- No hardcoded credentials (secure configuration required)
- Watchdog timer prevents hangs (30-second timeout)
- Memory monitoring prevents crashes
- Automatic reconnection on connection loss
- Rate limiting prevents command flooding

---
**Created for AIMS Smart Classroom System**
**Date**: September 18, 2025