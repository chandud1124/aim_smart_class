# ESP32 IntelliSense Configuration

This directory contains C/C++ IntelliSense configuration for ESP32 development.

## Setup Instructions

### 1. Install Required Arduino Libraries

The following libraries are required for full IntelliSense support:

1. **ArduinoJson** - For JSON parsing
   - Open Arduino IDE
   - Go to Sketch > Include Library > Manage Libraries
   - Search for "ArduinoJson" and install the latest version

2. **WebSockets** - For WebSocket communication
   - In Arduino IDE Library Manager
   - Search for "WebSockets" by Markus Sattler and install

### 2. IntelliSense Configuration

The `c_cpp_properties.json` file is configured for:

- **Windows** with Arduino IDE ESP32 core 3.3.0
- **ESP32** target with proper include paths
- **Standard C++17** and C11 support

### 3. Selecting Configuration

In VS Code:
1. Press `Ctrl+Shift+P`
2. Type "C/C++: Select Configuration"
3. Choose "Windows" for Arduino IDE development

### 4. Troubleshooting

If you still see IntelliSense errors:

1. **Restart VS Code** after installing libraries
2. **Verify Arduino IDE installation** path matches the configuration
3. **Check Arduino IDE version** - ensure ESP32 core 3.3.0 is installed
4. **Update include paths** if your Arduino installation is in a different location

### 5. Alternative: ESP-IDF

If you're using ESP-IDF instead of Arduino:
1. Install ESP-IDF
2. Set the `IDF_PATH` environment variable
3. Select "ESP-IDF" configuration in VS Code

## File Structure

- `c_cpp_properties.json` - C/C++ IntelliSense configuration
- `../*.cpp` - ESP32 source files
- `../*.h` - ESP32 header files