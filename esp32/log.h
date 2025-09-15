#pragma once
#include <Arduino.h>

enum LogLevel {
  LOG_ERROR = 0,
  LOG_WARN = 1,
  LOG_INFO = 2,
  LOG_DEBUG = 3
};

extern LogLevel CURRENT_LOG_LEVEL;

// Logging macros
#define LOG(level, fmt, ...) do { \
  if (level <= CURRENT_LOG_LEVEL) { \
    Serial.printf("[%lu] [%s] " fmt "\n", millis(), #level, ##__VA_ARGS__); \
  } \
} while(0)

#define LOGE(fmt, ...) LOG(LOG_ERROR, fmt, ##__VA_ARGS__)
#define LOGW(fmt, ...) LOG(LOG_WARN, fmt, ##__VA_ARGS__)
#define LOGI(fmt, ...) LOG(LOG_INFO, fmt, ##__VA_ARGS__)
#define LOGD(fmt, ...) LOG(LOG_DEBUG, fmt, ##__VA_ARGS__)

// Specialized logging for different components
#define LOG_WS(level, fmt, ...) LOG(level, "[WS] " fmt, ##__VA_ARGS__)
#define LOG_CMD(level, fmt, ...) LOG(level, "[CMD] " fmt, ##__VA_ARGS__)
#define LOG_NIGHT(level, fmt, ...) LOG(level, "[NIGHT] " fmt, ##__VA_ARGS__)
#define LOG_MANUAL(level, fmt, ...) LOG(level, "[MANUAL] " fmt, ##__VA_ARGS__)
#define LOG_HEALTH(level, fmt, ...) LOG(level, "[HEALTH] " fmt, ##__VA_ARGS__)
#define LOG_MEM(level, fmt, ...) LOG(level, "[MEM] " fmt, ##__VA_ARGS__)
#define LOG_DAY(level, fmt, ...) LOG(level, "[DAY] " fmt, ##__VA_ARGS__)