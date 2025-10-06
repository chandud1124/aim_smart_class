// config.h for ESP32 MQTT Classroom Automation
// Edit these values for your WiFi and device configuration

#ifndef CONFIG_H
#define CONFIG_H

#define WIFI_SSID "AIMS-WIFI"
#define WIFI_PASSWORD "Aimswifi#2025"

#define DEVICE_SECRET "351e01d4ccc5023263388c643badeb0a9672563d5bed0db7" // Optional: Device secret/API key for authentication

// MQTT Broker Configuration - Update this to match your network
#define MQTT_BROKER "172.16.3.171"      // Backend server IP
#define MQTT_PORT 1883                  // MQTT port

// Aligned relay and manual switch pin mapping
// relayPins[i] corresponds to manualSwitchPins[i]
int relayPins[6] = {16, 17, 18, 19, 21, 22};
int manualSwitchPins[6] = {25, 26, 27, 32, 33, 23};

// Relay configuration
#define RELAY_ACTIVE_HIGH false  // Set to true if relays are active HIGH, false if active LOW
#define MANUAL_ACTIVE_LOW true  // Set to true if manual switches are active LOW (pulled up), false if active HIGH

#endif // CONFIG_H
