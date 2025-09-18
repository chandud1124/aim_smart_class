# ESP32 Production Firmware - Arduino Libraries Required

## Required Arduino Libraries
Install these libraries through Arduino IDE Library Manager (Sketch → Include Library → Manage Libraries):

### Core Libraries (Required)
1. **WebSockets by Markus Sattler** - For WebSocket communication
   - Search for: "WebSockets"
   - Install version: Latest stable

2. **ArduinoJson by Benoit Blanchon** - For JSON message handling
   - Search for: "ArduinoJson"
   - Install version: 6.21.0 or later

### ESP32 Board Support
Make sure you have ESP32 board support installed:
1. Open Arduino IDE
2. Go to File → Preferences
3. Add this URL to "Additional Boards Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to Tools → Board → Boards Manager
5. Search for "esp32" and install "esp32 by Espressif Systems"

## Hardware Requirements
- ESP32 development board (ESP32-WROOM-32 recommended)
- USB cable for programming
- Power supply (if not using USB power)

## Upload Steps
1. Connect ESP32 to computer via USB
2. Open Arduino IDE
3. File → Open → Navigate to this folder
4. Select `production_ready_firmware.ino`
5. Tools → Board → Select your ESP32 board
6. Tools → Port → Select the correct COM port
7. Click the Upload button (right arrow icon)

## First Boot Configuration
After successful upload:
1. Open Serial Monitor (Tools → Serial Monitor)
2. Set baud rate to 115200
3. ESP32 will show configuration options
4. Follow on-screen instructions to configure WiFi and backend

## Troubleshooting Upload Issues
- Ensure correct COM port is selected
- Try pressing and holding BOOT button during upload
- Check USB cable and drivers
- Verify ESP32 board selection
- Close Serial Monitor if open during upload

## Verification
After upload, you should see in Serial Monitor:
```
=== ESP32 Production System Starting ===
Configuration loaded: WiFi='...', Backend='...'
WiFi connected, IP: ...
WebSocket manager initialized
=== Setup Complete ===
```

---
**Ready for ESP32 upload and deployment**