#ifndef CONFIG_H#ifndef CONFIG_H

#define CONFIG_H#define CONFIG_H



#include <Arduino.h>#include <Arduino.h>



// Include secure configuration if available (auto-generated)// ---------------- WiFi ----------------

#ifdef ENCRYPTED_CONFIG#define WIFI_SSID "AIMS-WIFI"

#include "secure_config.h"#define WIFI_PASSWORD "Aimswifi#2025"

#else

// ---------------- WiFi ----------------// ---------------- WebSocket ----------------

#define WIFI_SSID "AIMS-WIFI"#define WEBSOCKET_HOST "172.16.3.171" // Updated to match current backend server

#define WIFI_PASSWORD "Aimswifi#2025"#define WEBSOCKET_PORT 3001          // Backend server port

// Raw WebSocket endpoint path (matches backend server.js)

// ---------------- WebSocket ----------------#define WEBSOCKET_PATH "/esp32-ws"

#define WEBSOCKET_HOST "172.16.3.171" // Updated to match current backend server// Device authentication

#define WEBSOCKET_PORT 3001          // Backend server port#define DEVICE_SECRET_KEY "eb2930a2e8e3e5cee3743217ea321b1e3929f15ff8e27def"

// Raw WebSocket endpoint path (matches backend server.js)

#define WEBSOCKET_PATH "/esp32-ws"// ---------------- Pins ----------------

// Device authentication#define LED_PIN 2 // Built-in LED on most ESP32 dev boards

#define DEVICE_SECRET_KEY "eb2930a2e8e3e5cee3743217ea321b1e3929f15ff8e27def"#define MAX_SWITCHES 8

#endif

// Relay logic (Most ESP32 relay boards are ACTIVE LOW)

// ---------------- Pins ----------------#ifndef RELAY_ACTIVE_LOW

#define LED_PIN 2 // Built-in LED on most ESP32 dev boards#define RELAY_ACTIVE_LOW 1

#define MAX_SWITCHES 8#endif

#if RELAY_ACTIVE_LOW

// Relay logic (Most ESP32 relay boards are ACTIVE LOW)#define RELAY_ON_LEVEL LOW

#ifndef RELAY_ACTIVE_LOW#define RELAY_OFF_LEVEL HIGH

#define RELAY_ACTIVE_LOW 1#else

#endif#define RELAY_ON_LEVEL HIGH

#if RELAY_ACTIVE_LOW#define RELAY_OFF_LEVEL LOW

#define RELAY_ON_LEVEL LOW#endif

#define RELAY_OFF_LEVEL HIGH

#else// ---------------- Timers ----------------

#define RELAY_ON_LEVEL HIGH#define WIFI_RETRY_INTERVAL_MS 3000

#define RELAY_OFF_LEVEL LOW#define HEARTBEAT_INTERVAL_MS 15000

#endif#define DEBOUNCE_MS 80

#define USE_SECURE_WS 1

// ---------------- Timers ----------------

#define WIFI_RETRY_INTERVAL_MS 3000// ---------------- Default switch map (factory) ----------------

#define HEARTBEAT_INTERVAL_MS 15000struct SwitchConfig

#define DEBOUNCE_MS 80{

#define USE_SECURE_WS 1  int relayPin;

  int manualPin;

// ---------------- Default switch map (factory) ----------------  String name;

struct SwitchConfig  bool manualActiveLow; // true if LOW = ON (closed)

{};

  int relayPin;

  int manualPin;// Only declare it here

  String name;extern const SwitchConfig defaultSwitchConfigs[MAX_SWITCHES];

  bool manualActiveLow; // true if LOW = ON (closed)// #include "config.h"

};

// Define the default switches here (only once!)

// Only declare it hereconst SwitchConfig defaultSwitchConfigs[MAX_SWITCHES] = {

extern const SwitchConfig defaultSwitchConfigs[MAX_SWITCHES];    {4, 25, "Fan1", true},

// #include "config.h"    {16, 27, "Fan2", true},

    {17, 32, "Light1", true},

// Define the default switches here (only once!)    {5, 33, "Light2", true},

const SwitchConfig defaultSwitchConfigs[MAX_SWITCHES] = {    {19, 12, "Projector", true},

    {4, 25, "Fan1", true},    {18, 14, "NComputing", true},

    {16, 27, "Fan2", true},    {21, 13, "AC Unit", true},

    {17, 32, "Light1", true},    {22, 15, "Printer", true}};

    {5, 33, "Light2", true},#endif // CONFIG_H
    {19, 12, "Projector", true},
    {18, 14, "NComputing", true},
    {21, 13, "AC Unit", true},
    {22, 15, "Printer", true}};
#endif // CONFIG_H