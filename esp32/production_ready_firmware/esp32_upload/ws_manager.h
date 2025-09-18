// -----------------------------------------------------------------------------
// WebSocket Manager for ESP32
// Manages WebSocket connections with automatic reconnection
// -----------------------------------------------------------------------------
#pragma once

#ifndef WS_MANAGER_H
#define WS_MANAGER_H

#include <WebSocketsClient.h>
#include <Arduino.h>
#include <functional>

// WebSocket connection states
typedef enum {
    WS_DISCONNECTED = 0,
    WS_CONNECTING = 1,
    WS_CONNECTED = 2,
    WS_ERROR = 3
} WSState;

// WebSocket manager class
class WSManager {
private:
    WebSocketsClient client;
    WSState state;
    String host;
    uint16_t port;
    String path;
    unsigned long lastConnectAttempt;
    unsigned long reconnectInterval;
    int maxReconnectAttempts;
    int currentReconnectAttempts;
    bool autoReconnect;

    // Connection callbacks
    std::function<void(uint8_t*, size_t)> messageCallback;
    std::function<void()> connectCallback;
    std::function<void()> disconnectCallback;

    // Internal event handlers
    void onWSEvent(WStype_t type, uint8_t* payload, size_t length);

public:
    // Constructor
    WSManager(const char* wsHost = "", uint16_t wsPort = 80, const char* wsPath = "/")
        : state(WS_DISCONNECTED), host(wsHost), port(wsPort), path(wsPath),
          lastConnectAttempt(0), reconnectInterval(15000), maxReconnectAttempts(-1),
          currentReconnectAttempts(0), autoReconnect(true) {}

    // Initialize with host/port/path
    void begin(const char* wsHost = "", uint16_t wsPort = 80, const char* wsPath = "/") {
        if (wsHost && strlen(wsHost) > 0) host = wsHost;
        if (wsPort > 0) port = wsPort;
        if (wsPath && strlen(wsPath) > 0) path = wsPath;

        // Set up event handler
        client.onEvent([this](WStype_t type, uint8_t* payload, size_t length) {
            this->onWSEvent(type, payload, length);
        });

        state = WS_DISCONNECTED;
    }

    // Set message callback
    void setMessageCallback(std::function<void(uint8_t*, size_t)> callback) {
        messageCallback = callback;
    }

    // Set connect callback
    void setConnectCallback(std::function<void()> callback) {
        connectCallback = callback;
    }

    // Set disconnect callback
    void setDisconnectCallback(std::function<void()> callback) {
        disconnectCallback = callback;
    }

    // Connect to WebSocket server
    bool connect() {
        if (state == WS_CONNECTED) return true;
        if (host.length() == 0) return false;

        state = WS_CONNECTING;
        lastConnectAttempt = millis();

        Serial.printf("[WS] Connecting to %s:%d%s\n", host.c_str(), port, path.c_str());

        client.begin(host.c_str(), port, path.c_str());
        return true;
    }

    // Disconnect from WebSocket server
    void disconnect() {
        if (state != WS_DISCONNECTED) {
            client.disconnect();
            state = WS_DISCONNECTED;
            currentReconnectAttempts = 0;
        }
    }

    // Send text message
    bool sendTXT(const char* payload) {
        if (state != WS_CONNECTED) return false;
        return client.sendTXT(payload);
    }

    // Send binary message
    bool sendBIN(uint8_t* payload, size_t length) {
        if (state != WS_CONNECTED) return false;
        return client.sendBIN(payload, length);
    }

    // Check if connected
    bool isConnected() {
        return state == WS_CONNECTED;
    }

    // Get current state
    WSState getState() {
        return state;
    }

    // Loop function (call in main loop)
    void loop() {
        client.loop();

        // Handle auto-reconnection
        if (autoReconnect && state == WS_DISCONNECTED) {
            unsigned long now = millis();
            if (now - lastConnectAttempt >= reconnectInterval) {
                if (maxReconnectAttempts == -1 || currentReconnectAttempts < maxReconnectAttempts) {
                    currentReconnectAttempts++;
                    connect();
                }
            }
        }
    }

    // Set auto-reconnect parameters
    void setReconnectParams(unsigned long interval, int maxAttempts = -1) {
        reconnectInterval = interval;
        maxReconnectAttempts = maxAttempts;
    }

    // Enable/disable auto-reconnect
    void setAutoReconnect(bool enable) {
        autoReconnect = enable;
    }

    // Get connection info
    String getHost() { return host; }
    uint16_t getPort() { return port; }
    String getPath() { return path; }

    // Get reconnect statistics
    int getReconnectAttempts() { return currentReconnectAttempts; }
    unsigned long getTimeSinceLastAttempt() {
        return millis() - lastConnectAttempt;
    }
};

// Global WebSocket event handler
void WSManager::onWSEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected");
            state = WS_DISCONNECTED;
            if (disconnectCallback) {
                disconnectCallback();
            }
            break;

        case WStype_CONNECTED:
            Serial.printf("[WS] Connected to %s\n", payload);
            state = WS_CONNECTED;
            currentReconnectAttempts = 0;
            if (connectCallback) {
                connectCallback();
            }
            break;

        case WStype_TEXT:
            if (messageCallback) {
                messageCallback(payload, length);
            }
            break;

        case WStype_BIN:
            Serial.printf("[WS] Binary message received, length: %d\n", length);
            break;

        case WStype_ERROR:
            Serial.println("[WS] Error occurred");
            state = WS_ERROR;
            break;

        case WStype_FRAGMENT_TEXT_START:
        case WStype_FRAGMENT_BIN_START:
        case WStype_FRAGMENT:
        case WStype_FRAGMENT_FIN:
            // Handle fragmented messages if needed
            break;

        default:
            break;
    }
}

#endif // WS_MANAGER_H
    std::function<void()> connectCallback;
    std::function<void()> disconnectCallback;

    // Internal event handlers
    void onWSEvent(WStype_t type, uint8_t* payload, size_t length);

public:
    // Constructor
    WSManager(const char* wsHost = "", uint16_t wsPort = 80, const char* wsPath = "/")
        : state(WS_DISCONNECTED), host(wsHost), port(wsPort), path(wsPath),
          lastConnectAttempt(0), reconnectInterval(15000), maxReconnectAttempts(-1),
          currentReconnectAttempts(0), autoReconnect(true) {}

    // Initialize with host/port/path
    void begin(const char* wsHost = "", uint16_t wsPort = 80, const char* wsPath = "/") {
        if (wsHost && strlen(wsHost) > 0) host = wsHost;
        if (wsPort > 0) port = wsPort;
        if (wsPath && strlen(wsPath) > 0) path = wsPath;

        // Set up event handler
        client.onEvent([this](WStype_t type, uint8_t* payload, size_t length) {
            this->onWSEvent(type, payload, length);
        });

        state = WS_DISCONNECTED;
    }

    // Set message callback
    void setMessageCallback(std::function<void(uint8_t*, size_t)> callback) {
        messageCallback = callback;
    }

    // Set connect callback
    void setConnectCallback(std::function<void()> callback) {
        connectCallback = callback;
    }

    // Set disconnect callback
    void setDisconnectCallback(std::function<void()> callback) {
        disconnectCallback = callback;
    }

    // Connect to WebSocket server
    bool connect() {
        if (state == WS_CONNECTED) return true;
        if (host.length() == 0) return false;

        state = WS_CONNECTING;
        lastConnectAttempt = millis();

        Serial.printf("[WS] Connecting to %s:%d%s\n", host.c_str(), port, path.c_str());

        client.begin(host.c_str(), port, path.c_str());
        return true;
    }

    // Disconnect from WebSocket server
    void disconnect() {
        if (state != WS_DISCONNECTED) {
            client.disconnect();
            state = WS_DISCONNECTED;
            currentReconnectAttempts = 0;
        }
    }

    // Send text message
    bool sendTXT(const char* payload) {
        if (state != WS_CONNECTED) return false;
        return client.sendTXT(payload);
    }

    // Send binary message
    bool sendBIN(uint8_t* payload, size_t length) {
        if (state != WS_CONNECTED) return false;
        return client.sendBIN(payload, length);
    }

    // Check if connected
    bool isConnected() {
        return state == WS_CONNECTED;
    }

    // Get current state
    WSState getState() {
        return state;
    }

    // Loop function (call in main loop)
    void loop() {
        client.loop();

        // Handle auto-reconnection
        if (autoReconnect && state == WS_DISCONNECTED) {
            unsigned long now = millis();
            if (now - lastConnectAttempt >= reconnectInterval) {
                if (maxReconnectAttempts == -1 || currentReconnectAttempts < maxReconnectAttempts) {
                    currentReconnectAttempts++;
                    connect();
                }
            }
        }
    }

    // Set auto-reconnect parameters
    void setReconnectParams(unsigned long interval, int maxAttempts = -1) {
        reconnectInterval = interval;
        maxReconnectAttempts = maxAttempts;
    }

    // Enable/disable auto-reconnect
    void setAutoReconnect(bool enable) {
        autoReconnect = enable;
    }

    // Get connection info
    String getHost() { return host; }
    uint16_t getPort() { return port; }
    String getPath() { return path; }

    // Get reconnect statistics
    int getReconnectAttempts() { return currentReconnectAttempts; }
    unsigned long getTimeSinceLastAttempt() {
        return millis() - lastConnectAttempt;
    }
};

// Global WebSocket event handler
void WSManager::onWSEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected");
            state = WS_DISCONNECTED;
            if (disconnectCallback) {
                disconnectCallback();
            }
            break;

        case WStype_CONNECTED:
            Serial.printf("[WS] Connected to %s\n", payload);
            state = WS_CONNECTED;
            currentReconnectAttempts = 0;
            if (connectCallback) {
                connectCallback();
            }
            break;

        case WStype_TEXT:
            if (messageCallback) {
                messageCallback(payload, length);
            }
            break;

        case WStype_BIN:
            Serial.printf("[WS] Binary message received, length: %d\n", length);
            break;

        case WStype_ERROR:
            Serial.println("[WS] Error occurred");
            state = WS_ERROR;
            break;

        case WStype_FRAGMENT_TEXT_START:
        case WStype_FRAGMENT_BIN_START:
        case WStype_FRAGMENT:
        case WStype_FRAGMENT_FIN:
            // Handle fragmented messages if needed
            break;

        default:
            break;
    }
}

#endif // WS_MANAGER_H