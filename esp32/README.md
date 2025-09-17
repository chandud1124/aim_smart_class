# ESP32 IntelliSense Setup Guide

## Overview
This guide will help you resolve C/C++ IntelliSense errors in VS Code for ESP32 Arduino development.

## Prerequisites
- Arduino IDE installed with ESP32 core (version 3.3.0 or later)
- VS Code with C/C++ extension installed
- ESP32 development board

## Required Arduino Libraries
Install the following libraries via Arduino IDE Library Manager:

### 1. ArduinoJson
- **Purpose**: JSON parsing and serialization for WebSocket communication
- **Installation**: Arduino IDE → Tools → Manage Libraries → Search for "ArduinoJson" → Install latest version (6.x or 7.x)

### 2. WebSockets
- **Purpose**: WebSocket client library for backend communication
- **Installation**: Arduino IDE → Tools → Manage Libraries → Search for "WebSockets" → Install latest version by Markus Sattler

## VS Code Configuration
The IntelliSense configuration has been updated for Windows Arduino IDE paths. The configuration includes:

- ESP32 core include paths
- ESP32 toolchain include paths (xtensa-esp-elf)
- Standard C++ library paths
- Arduino IDE library paths

## Files with IntelliSense Issues (Now Resolved)

### memutils.h
- **Issue**: `esp_heap_caps.h` could not be found
- **Solution**: Added ESP32 core include paths to VS Code configuration
- **Purpose**: Memory management utilities with safe allocation functions

### safe_string.h
- **Issue**: `cstring` could not be found
- **Solution**: Added ESP32 toolchain include paths to VS Code configuration
- **Purpose**: Safe string operations with bounds checking

### ws_manager.h / ws_manager.cpp
- **Issue**: `WebSocketsClient.h` could not be found
- **Solution**: Install WebSockets library via Arduino IDE Library Manager
- **Purpose**: WebSocket client management for ESP32 backend communication

## Next Steps
1. Install the required Arduino libraries (ArduinoJson and WebSockets)
2. Restart VS Code to apply the new IntelliSense configuration
3. The IntelliSense errors for `esp_heap_caps.h` and `cstring` should be resolved
4. If you still see errors, verify your Arduino IDE installation path matches the configuration

## Troubleshooting
- **Still seeing include errors?** Check that your Arduino IDE is installed in the default location: `C:\Program Files (x86)\Arduino`
- **Library not found?** Ensure the libraries are installed for the ESP32 board (not just Arduino AVR)
- **Configuration not working?** Try restarting VS Code completely

## Configuration Details
The VS Code C/C++ configuration (`.vscode/c_cpp_properties.json`) includes:
- Windows Arduino IDE paths
- ESP32 core 3.3.0 include directories
- ESP32 toolchain compiler paths
- Standard C++ header locations