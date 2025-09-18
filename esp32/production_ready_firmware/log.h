// -----------------------------------------------------------------------------
// ESP32 Logging System
// Minimal logging with different levels for production use
// -----------------------------------------------------------------------------
// This provides a simple logging system that can be enabled/disabled
// for different log levels to save memory and processing time.

#ifndef LOG_H
#define LOG_H

#include <Arduino.h>
#include "safe_string.h"

// Log levels
typedef enum {
    LOG_NONE = 0,   // No logging
    LOG_ERROR = 1,  // Only errors
    LOG_WARN = 2,   // Errors and warnings
    LOG_INFO = 3,   // Errors, warnings, and info
    LOG_DEBUG = 4,  // All including debug
    LOG_TRACE = 5   // Everything including trace
} LogLevel;

// Current log level (can be changed at runtime)
extern LogLevel CURRENT_LOG_LEVEL;

// Initialize logging system
inline void initLogging(LogLevel level = LOG_INFO) {
    CURRENT_LOG_LEVEL = level;
}

// Set log level
inline void setLogLevel(LogLevel level) {
    CURRENT_LOG_LEVEL = level;
}

// Get current timestamp for logging
inline String getLogTimestamp() {
    unsigned long ms = millis();
    unsigned long seconds = ms / 1000;
    unsigned long minutes = seconds / 60;
    unsigned long hours = minutes / 60;

    char buffer[16];
    safe_snprintf(buffer, sizeof(buffer), "%02lu:%02lu:%02lu",
                  hours % 24, minutes % 60, seconds % 60);
    return String(buffer);
}

// Generic log function
inline void logMessage(LogLevel level, const char* levelStr, const char* format, va_list args) {
    if (level > CURRENT_LOG_LEVEL) return;

    // Get timestamp
    String timestamp = getLogTimestamp();

    // Print level and timestamp
    Serial.printf("[%s %s] ", levelStr, timestamp.c_str());

    // Print formatted message
    char buffer[256];
    vsnprintf(buffer, sizeof(buffer), format, args);
    Serial.println(buffer);

    // Add newline if not present
    if (buffer[strlen(buffer) - 1] != '\n') {
        Serial.println();
    }
}

// Error logging
inline void LOG_ERROR(const char* format, ...) {
    va_list args;
    va_start(args, format);
    logMessage(LOG_ERROR, "ERROR", format, args);
    va_end(args);
}

// Warning logging
inline void LOG_WARN(const char* format, ...) {
    va_list args;
    va_start(args, format);
    logMessage(LOG_WARN, "WARN", format, args);
    va_end(args);
}

// Info logging
inline void LOG_INFO(const char* format, ...) {
    va_list args;
    va_start(args, format);
    logMessage(LOG_INFO, "INFO", format, args);
    va_end(args);
}

// Debug logging
inline void LOG_DEBUG(const char* format, ...) {
    va_list args;
    va_start(args, format);
    logMessage(LOG_DEBUG, "DEBUG", format, args);
    va_end(args);
}

// Trace logging
inline void LOG_TRACE(const char* format, ...) {
    va_list args;
    va_start(args, format);
    logMessage(LOG_TRACE, "TRACE", format, args);
    va_end(args);
}

// Health logging (always shown regardless of level)
inline void LOG_HEALTH(LogLevel level, const char* format, ...) {
    if (level > CURRENT_LOG_LEVEL && level != LOG_ERROR) return;

    va_list args;
    va_start(args, format);
    logMessage(level, "HEALTH", format, args);
    va_end(args);
}

// WebSocket logging
inline void LOG_WS(LogLevel level, const char* format, ...) {
    if (level > CURRENT_LOG_LEVEL) return;

    va_list args;
    va_start(args, format);
    logMessage(level, "WS", format, args);
    va_end(args);
}

// Convenience macros for common logging
#define LOGI(format, ...) LOG_INFO(format, ##__VA_ARGS__)
#define LOGW(format, ...) LOG_WARN(format, ##__VA_ARGS__)
#define LOGE(format, ...) LOG_ERROR(format, ##__VA_ARGS__)
#define LOGD(format, ...) LOG_DEBUG(format, ##__VA_ARGS__)
#define LOGT(format, ...) LOG_TRACE(format, ##__VA_ARGS__)

#endif // LOG_H