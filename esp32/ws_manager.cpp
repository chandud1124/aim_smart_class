#include "ws_manager.h"
#include "log.h"

void WSManager::begin() {
  LOG_WS(LOG_INFO, "Initializing WebSocket connection to %s:%d%s", url_, port_, path_);
  ws_.begin(url_, port_, path_);
  ws_.onEvent(onEvent);
  ws_.setReconnectInterval(5000); // Disable auto-reconnect, we'll handle it
  ws_.enableHeartbeat(15000, 3000, 2); // 15s ping, 3s pong timeout, 2 retries
  connect();
}

void WSManager::connect() {
  unsigned long now = millis();
  if (now - lastConnectAttemptMs_ < backoffMs_) {
    return; // Still in backoff period
  }

  lastConnectAttemptMs_ = now;
  LOG_WS(LOG_INFO, "Attempting WebSocket connection (attempt %d)", reconnectAttempts_ + 1);

  bool ok = ws_.connect();
  if (!ok) {
    reconnectAttempts_++;
    // Exponential backoff with jitter
    backoffMs_ = min(maxBackoffMs_, backoffMs_ * 2 + (random(0, 500)));
    LOG_WS(LOG_WARN, "WebSocket connection failed, backing off for %lu ms", backoffMs_);
  } else {
    reconnectAttempts_ = 0;
    backoffMs_ = 1000; // Reset backoff on success
    LOG_WS(LOG_INFO, "WebSocket connected successfully");
  }
}

void WSManager::loop() {
  ws_.loop();
  if (!ws_.isConnected()) {
    connect();
  }
}

bool WSManager::sendTXT(const char* data) {
  if (!ws_.isConnected()) {
    LOG_WS(LOG_WARN, "Cannot send: WebSocket not connected");
    return false;
  }

  bool result = ws_.sendTXT(data);
  if (!result) {
    LOG_WS(LOG_ERROR, "Failed to send WebSocket message");
  }
  return result;
}

void WSManager::disconnect() {
  LOG_WS(LOG_INFO, "Disconnecting WebSocket");
  ws_.disconnect();
}

void WSManager::onEvent(WStype_t type, uint8_t* payload, size_t length) {
  // This is a static method, we need to get the instance
  // For simplicity, we'll assume single instance for now
  // In production, you'd want a better way to handle this
  extern WSManager* g_wsManager;
  if (g_wsManager) {
    g_wsManager->handleEvent(type, payload, length);
  }
}

void WSManager::handleEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      LOG_WS(LOG_WARN, "WebSocket disconnected");
      reconnectAttempts_ = 0; // Reset for next connection attempt
      break;

    case WStype_CONNECTED:
      LOG_WS(LOG_INFO, "WebSocket connected to server");
      break;

    case WStype_TEXT:
      LOG_WS(LOG_DEBUG, "Received WebSocket text message (%d bytes)", length);
      if (messageCallback_ && payload && length > 0) {
        messageCallback_(payload, length);
      }
      break;

    case WStype_BIN:
      LOG_WS(LOG_DEBUG, "Received WebSocket binary message (%d bytes)", length);
      break;

    case WStype_ERROR:
      LOG_WS(LOG_ERROR, "WebSocket error occurred");
      break;

    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
      LOG_WS(LOG_DEBUG, "WebSocket fragment received");
      break;

    case WStype_PING:
      LOG_WS(LOG_DEBUG, "WebSocket ping received");
      break;

    case WStype_PONG:
      LOG_WS(LOG_DEBUG, "WebSocket pong received");
      break;

    default:
      LOG_WS(LOG_WARN, "Unknown WebSocket event type: %d", type);
      break;
  }
}