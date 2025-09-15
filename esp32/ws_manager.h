#pragma once
#include <WebSocketsClient.h>
#include <Arduino.h>

class WSManager {
public:
  WSManager(const char* url, uint16_t port = 80, const char* path = "/")
    : url_(url), port_(port), path_(path) {}

  void begin();
  void loop();
  bool sendTXT(const char* data);
  bool isConnected() const { return ws_.isConnected(); }
  void disconnect();

  // Callback for handling incoming messages
  void setMessageCallback(void (*callback)(uint8_t*, size_t)) {
    messageCallback_ = callback;
  }

private:
  WebSocketsClient ws_;
  const char* url_;
  uint16_t port_;
  const char* path_;
  unsigned long lastConnectAttemptMs_ = 0;
  unsigned long backoffMs_ = 1000;
  const unsigned long maxBackoffMs_ = 60UL * 1000; // 1 minute max
  int reconnectAttempts_ = 0;
  const int maxReconnectAttempts_ = 10;

  void (*messageCallback_)(uint8_t*, size_t) = nullptr;

  void connect();
  static void onEvent(WStype_t type, uint8_t* payload, size_t length);
  void handleEvent(WStype_t type, uint8_t* payload, size_t length);
};