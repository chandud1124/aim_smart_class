// -----------------------------------------------------------------------------
// ESP32 Configuration Header
// Minimal configuration definitions for production use
// -----------------------------------------------------------------------------
// This file provides basic configuration constants and definitions
// that are used throughout the ESP32 firmware.

#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration (will be overridden by secure config)
// REMOVE THESE HARDCODED VALUES FOR PRODUCTION
#define WIFI_SSID "AIMS-WIFI"
#define WIFI_PASSWORD "Aimswifi#2025"

// Backend Configuration (will be overridden by secure config)
// REMOVE THESE HARDCODED VALUES FOR PRODUCTION
#define BACKEND_HOST "172.16.3.171"
#define BACKEND_PORT 3001
#define WS_PATH "/esp32-ws"

// Device Configuration
// REMOVE THIS HARDCODED SECRET FOR PRODUCTION
#define DEVICE_SECRET "eb2930a2e8e3e5cee3743217ea321b1e3929f15ff8e27def"

// Timing Constants
#define HEARTBEAT_MS 30000UL
#define STATE_DEBOUNCE_MS 200
#define MANUAL_DEBOUNCE_MS 80
#define MANUAL_PRIORITY_MS 5000
#define MANUAL_REPEAT_IGNORE_MS 200
#define COMMAND_PROCESS_INTERVAL 100

// Queue and Buffer Sizes
#define MAX_COMMAND_QUEUE 16
#define MSG_BUFFER_SIZE 512
#define JSON_BUFFER_SIZE 1536

// Watchdog and Safety
#define WDT_TIMEOUT_MS 30000
#define WIFI_RETRY_INTERVAL_MS 30000UL
#define IDENTIFY_RETRY_MS 10000UL
#define WS_RECONNECT_INTERVAL_MS 15000UL

// Relay Configuration
#define RELAY_ON_LEVEL LOW
#define RELAY_OFF_LEVEL HIGH

// Night Time Protection
#define NIGHT_START_HOUR 22
#define NIGHT_END_HOUR 6
#define ALLOW_OFF_DURING_NIGHT true
#define PENDING_COMMAND_TIMEOUT_HOURS 12

// Status LED (set to 255 to disable)
#ifndef STATUS_LED_PIN
#define STATUS_LED_PIN 2
#endif

#endif // CONFIG_H