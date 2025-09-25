#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ---------------- WiFi ----------------
#define WIFI_SSID "AIMS-WIFI"
#define WIFI_PASSWORD "Aimswifi#2025"

// ---------------- MQTT ----------------
#define MQTT_BROKER_HOST "172.16.3.171" // Backend server IP (MQTT broker)
#define MQTT_BROKER_PORT 1883            // MQTT broker port (Mosquitto)
#define DEVICE_SECRET_KEY "c884b57e68f61d109d1fa4e1b6aefd744cc864d8b7b16d37"

// ---------------- Pins ----------------
#define LED_PIN 2 // Built-in LED on most ESP32 dev boards
#define MAX_SWITCHES 8

// Relay logic (Most ESP32 relay boards are ACTIVE LOW)
#ifndef RELAY_ACTIVE_LOW
#define RELAY_ACTIVE_LOW 1
#endif
#if RELAY_ACTIVE_LOW
#define RELAY_ON_LEVEL LOW
#define RELAY_OFF_LEVEL HIGH
#else
#define RELAY_ON_LEVEL HIGH
#define RELAY_OFF_LEVEL LOW
#endif

// ---------------- Timers ----------------
#define WIFI_RETRY_INTERVAL_MS 3000
#define HEARTBEAT_INTERVAL_MS 15000
#define DEBOUNCE_MS 80

// ---------------- Default switch map (factory) ----------------
struct SwitchConfig
{
  int relayPin;
  int manualPin;
  String name;
  bool manualActiveLow; // true if LOW = ON (closed)
};

// Only declare it here
extern const SwitchConfig defaultSwitchConfigs[MAX_SWITCHES];
// #include "config.h"

// Define the default switches here (only once!)
const SwitchConfig defaultSwitchConfigs[MAX_SWITCHES] = {
  {16, 25, "Fan1", true},       // GPIO 16 → Relay, GPIO 25 → Manual
  {17, 26, "Fan2", true},       // GPIO 17 → Relay, GPIO 26 → Manual
  {18, 27, "Light1", true},     // GPIO 18 → Relay, GPIO 27 → Manual
  {19, 32, "Light2", true},     // GPIO 19 → Relay, GPIO 32 → Manual
  {21, 33, "Projector", true},  // GPIO 21 → Relay, GPIO 33 → Manual
  {22, 23, "AC Unit", true},    // GPIO 22 → Relay, GPIO 23 → Manual
  
};
#endif // CONFIG_H