// -----------------------------------------------------------------------------
// Enhanced ESP32 <-> Backend WebSocket implementation with offline functionality
// Supports operation without WiFi/backend connection and prevents crashes
// Endpoint: ws://<HOST>:3001/esp32-ws (server.js)
// -----------------------------------------------------------------------------
// Core messages:
// -> identify {type:'identify', mac, secret}
// <- identified {type:'identified', mode, switches:[{gpio,relayGpio,name,...}]}
// <- config_update {type:'config_update', switches:[...]} (after UI edits)
// <- switch_command{type:'switch_command', gpio|relayGpio, state}
// -> state_update {type:'state_update', switches:[{gpio,state}]}
// -> heartbeat {type:'heartbeat', uptime}
// <- state_ack {type:'state_ack', changed}
// -----------------------------------------------------------------------------

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include "config.h"

// Uncomment to compile without mbedtls/HMAC (for older cores or minimal builds)
// #define DISABLE_HMAC 1
#ifndef DISABLE_HMAC
#include <mbedtls/md.h>
#endif

#define WIFI_SSID "AIMS-WIFI"
#define WIFI_PASSWORD "Aimswifi#2025"
#define BACKEND_HOST "172.16.3.171" // backend LAN IP
#define BACKEND_PORT 3001
#define WS_PATH "/esp32-ws"
#define HEARTBEAT_MS 30000UL // 30s heartbeat interval
#define DEVICE_SECRET "eb2930a2e8e3e5cee3743217ea321b1e3929f15ff8e27def" // device secret from backend

// Optional status LED (set to 255 to disable if your board lacks LED_BUILTIN)
#ifndef STATUS_LED_PIN
#define STATUS_LED_PIN 2
#endif

// Debounce multiple rapid local state changes into one state_update
#define STATE_DEBOUNCE_MS 200
#define MANUAL_DEBOUNCE_MS 30

// Command queue size and processing interval
#define MAX_COMMAND_QUEUE 16
#define COMMAND_PROCESS_INTERVAL 100 // Process commands every 100ms

// WiFi reconnection constants
#define WIFI_RETRY_INTERVAL_MS 30000UL
#define IDENTIFY_RETRY_MS 10000UL
#define WS_RECONNECT_INTERVAL_MS 15000UL // WebSocket reconnection interval

// Watchdog timeout (30 seconds)
#define WDT_TIMEOUT_MS 30000

// Active-low mapping: logical ON -> LOW, OFF -> HIGH (common relay boards)
#define RELAY_ON_LEVEL LOW
#define RELAY_OFF_LEVEL HIGH

// ========= Struct Definitions =========

// Extended switch state supports optional manual (wall) switch input GPIO
struct SwitchState
{
 int gpio; // relay control GPIO (output)
 bool state; // logical ON/OFF state
 String name; // label from backend
 int manualGpio = -1; // optional manual switch GPIO (input)
 bool manualEnabled = false; // whether manual input is active
 bool manualActiveLow = true; // per-switch input polarity (independent of relay polarity)
 bool manualMomentary = false; // true = momentary (toggle on active edge), false = maintained (level maps to state)
 int lastManualLevel = -1; // last raw digitalRead level
 unsigned long lastManualChangeMs = 0; // last time raw level flipped
 int stableManualLevel = -1; // debounced level
 bool lastManualActive = false; // previous debounced logical active level (after polarity)
 bool defaultState = false; // default state for offline mode
 bool manualOverride = false; // whether this switch was manually overridden
};

// Command queue to prevent crashes from multiple simultaneous commands
struct Command
{
 int gpio;
 bool state;
 bool valid;
 unsigned long timestamp;
};

// Track last applied sequence per GPIO to drop stale commands
struct GpioSeq
{
 int gpio;
 long seq;
};

// ========= Global Variables =========
WebSocketsClient ws;
Preferences prefs;
QueueHandle_t cmdQueue;
unsigned long lastHealthCheck = 0;
const unsigned long HEALTH_CHECK_INTERVAL_MS = 10000;
std::vector<SwitchState> switchesLocal; // dynamically populated
bool isOfflineMode = true;
std::vector<GpioSeq> lastSeqs;

// ========= Enhanced Error Handling =========
unsigned long lastErrorReport = 0;
const unsigned long ERROR_REPORT_INTERVAL_MS = 30000; // 30 seconds

// Connection state and identification tracking
bool identified = false;

// Enhanced error reporting
void reportError(const char *errorType, const char *message)
{
 unsigned long now = millis();
 if (now - lastErrorReport >= ERROR_REPORT_INTERVAL_MS)
 {
 Serial.printf("[ERROR] %s: %s\n", errorType, message);
 lastErrorReport = now;

 // Log health status on errors
 logHealth("Error Context");
 }
}

// Monitor critical operations
void monitorOperation(const char *operation, bool success)
{
 if (!success)
 {
 reportError("OPERATION_FAILED", operation);
 }
}

// Health monitoring function
void logHealth(const char *context)
{
 size_t freeHeap = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);
 size_t minFreeHeap = heap_caps_get_minimum_free_size(MALLOC_CAP_DEFAULT);
 UBaseType_t stackHighWaterMark = uxTaskGetStackHighWaterMark(NULL);
 size_t totalHeap = heap_caps_get_total_size(MALLOC_CAP_DEFAULT);

 Serial.printf("[HEALTH] %s | Heap: %u/%u KB (%u KB min) | Stack HWM: %u | Switches: %d | Mode: %s\n",
 context,
 freeHeap / 1024,
 totalHeap / 1024,
 minFreeHeap / 1024,
 stackHighWaterMark,
 switchesLocal.size(),
 isOfflineMode ? "OFFLINE" : "ONLINE");

 // Warning if heap is getting low
 if (freeHeap < 50000)
 { // Less than 50KB free - CRITICAL
 Serial.printf("[CRITICAL] Very low heap memory: %u bytes free!\n", freeHeap);
 
 // Emergency cleanup if memory gets dangerously low
 if (freeHeap < 30000) {
 Serial.println("[EMERGENCY] Attempting memory cleanup...");
 // Force garbage collection if available
 heap_caps_check_integrity_all(true);
 }
 }
 else if (freeHeap < 80000)
 { // Less than 80KB free - WARNING  
 Serial.printf("[WARNING] Heap memory getting low: %u bytes free\n", freeHeap);
 }

 // Warning if stack is getting low
 if (stackHighWaterMark < 1024)
 { // Less than 1KB stack remaining
 Serial.printf("[WARNING] Low stack space: %u bytes remaining!\n", stackHighWaterMark);
 }
}

// Check system health periodically
void checkSystemHealth()
{
 unsigned long now = millis();
 if (now - lastHealthCheck >= HEALTH_CHECK_INTERVAL_MS)
 {
 logHealth("Periodic");
 lastHealthCheck = now;

 // Additional health checks
 if (WiFi.status() != WL_CONNECTED)
 {
 Serial.println("[HEALTH] WiFi disconnected!");
 }
 else
 {
 Serial.printf("[HEALTH] WiFi connected, IP: %s\n", WiFi.localIP().toString().c_str());
 }

 if (!ws.isConnected() && !isOfflineMode)
 {
 Serial.println("[HEALTH] WebSocket disconnected!");
 }
 else if (ws.isConnected())
 {
 Serial.printf("[HEALTH] WebSocket connected, identified: %s\n", identified ? "YES" : "NO");
 }

 // Check command queue health
 UBaseType_t queueItems = uxQueueMessagesWaiting(cmdQueue);
 if (queueItems > MAX_COMMAND_QUEUE / 2)
 {
 Serial.printf("[HEALTH] Command queue getting full: %d/%d items\n", queueItems, MAX_COMMAND_QUEUE);
 }

 // Check switch states for anomalies
 int activeSwitches = 0;
 for (auto &sw : switchesLocal)
 {
 if (sw.state)
 activeSwitches++;
 }
 if (activeSwitches > switchesLocal.size() / 2)
 {
 Serial.printf("[HEALTH] Many switches active: %d/%d\n", activeSwitches, switchesLocal.size());
 }
 }
}

// Connection / timers
enum ConnState
{
 WIFI_DISCONNECTED,
 WIFI_ONLY,
 BACKEND_CONNECTED
};
ConnState connState = WIFI_DISCONNECTED;
unsigned long lastHeartbeat = 0;
unsigned long lastStateSent = 0;
unsigned long lastCommandProcess = 0;
unsigned long lastWiFiRetry = 0;
unsigned long lastIdentifyAttempt = 0;
unsigned long lastWsReconnectAttempt = 0; // Track WebSocket reconnection attempts
bool pendingState = false;
int reconnectionAttempts = 0;

// Forward declarations
void sendJson(const JsonDocument &doc);
String hmacSha256(const String &key, const String &msg);
void identify();
void sendStateUpdate(bool force);
void sendHeartbeat();
long getLastSeq(int gpio);
void setLastSeq(int gpio, long seq);
bool applySwitchState(int gpio, bool state);
void sendManualSwitchEvent(int gpio, bool previousState, bool newState); // Add manual switch event function
void loadConfigFromJsonArray(JsonArray arr);
void saveConfigToNVS();
void loadConfigFromNVS();
void onWsEvent(WStype_t type, uint8_t *payload, size_t length);
void setupRelays();
void processCommandQueue();
void blinkStatus();
void handleManualSwitches();

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------
void sendJson(const JsonDocument &doc)
{
 if (!ws.isConnected())
 return;

 String out;
 serializeJson(doc, out);
 ws.sendTXT(out);
}

String hmacSha256(const String &key, const String &msg)
{
#ifdef DISABLE_HMAC
 // HMAC disabled: return empty string to skip signing
 (void)key;
 (void)msg;
 return String("");
#else
 byte hmacResult[32];
 mbedtls_md_context_t ctx;
 const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
 mbedtls_md_init(&ctx);
 mbedtls_md_setup(&ctx, info, 1);
 mbedtls_md_hmac_starts(&ctx, (const unsigned char *)key.c_str(), key.length());
 mbedtls_md_hmac_update(&ctx, (const unsigned char *)msg.c_str(), msg.length());
 mbedtls_md_hmac_finish(&ctx, hmacResult);
 mbedtls_md_free(&ctx);
 char buf[65];
 for (int i = 0; i < 32; i++)
 sprintf(&buf[i * 2], "%02x", hmacResult[i]);
 buf[64] = '\0';
 return String(buf);
#endif
}

void identify()
{
 DynamicJsonDocument doc(256);
 doc["type"] = "identify";
 doc["mac"] = WiFi.macAddress();
 doc["secret"] = DEVICE_SECRET; // simple shared secret (upgrade to HMAC if needed)
 doc["offline_capable"] = true; // Indicate this device supports offline mode
 sendJson(doc);
 lastIdentifyAttempt = millis();
}

void sendStateUpdate(bool force)
{
 unsigned long now = millis();
 if (!force && now - lastStateSent < STATE_DEBOUNCE_MS)
 {
 pendingState = true;
 return;
 }
 pendingState = false;
 lastStateSent = now;

 // Don't try to send if not connected
 if (!ws.isConnected())
 return;

 DynamicJsonDocument doc(512);
 doc["type"] = "state_update";
 doc["seq"] = (long)(millis()); // coarse monotonic seq for state_update
 doc["ts"] = (long)(millis());
 JsonArray arr = doc.createNestedArray("switches");
 for (auto &sw : switchesLocal)
 {
 JsonObject o = arr.createNestedObject();
 o["gpio"] = sw.gpio;
 o["state"] = sw.state;
 o["manual_override"] = sw.manualOverride;
 }
 if (strlen(DEVICE_SECRET) > 0)
 {
 String base = WiFi.macAddress();
 base += "|";
 base += (long)doc["seq"];
 base += "|";
 base += (long)doc["ts"];
 doc["sig"] = hmacSha256(DEVICE_SECRET, base);
 }
 sendJson(doc);
 Serial.println(F("[WS] -> state_update"));
}

void sendHeartbeat()
{
 unsigned long now = millis();
 if (now - lastHeartbeat < HEARTBEAT_MS)
 return;
 lastHeartbeat = now;

 if (ws.isConnected())
 {
 DynamicJsonDocument doc(256);
 doc["type"] = "heartbeat";
 doc["mac"] = WiFi.macAddress();
 doc["uptime"] = millis() / 1000;
 doc["offline_mode"] = isOfflineMode;
 sendJson(doc);
 Serial.println("[WS] -> heartbeat");
 }
}

void sendManualSwitchEvent(int gpio, bool previousState, bool newState)
{
 // Don't send if not connected
 if (!ws.isConnected())
 {
 Serial.printf("[WS] Cannot send manual switch event - not connected\n");
 return;
 }

 // Find the switch to get its details
 for (auto &sw : switchesLocal)
 {
 if (sw.gpio == gpio)
 {
 DynamicJsonDocument doc(512);
 doc["type"] = "manual_switch";
 doc["mac"] = WiFi.macAddress();
 doc["switchId"] = String(gpio); // Using GPIO as switch ID (backend will match by GPIO)
 doc["gpio"] = gpio; // Also include GPIO for backend matching
 doc["action"] = newState ? "manual_on" : "manual_off";
 doc["previousState"] = previousState ? "on" : "off";
 doc["newState"] = newState ? "on" : "off";
 doc["detectedBy"] = "gpio_interrupt";
 doc["responseTime"] = millis() % 1000; // Simple response time simulation
 doc["physicalPin"] = sw.manualGpio;
 doc["timestamp"] = millis();

 if (strlen(DEVICE_SECRET) > 0)
 {
 String base = WiFi.macAddress();
 base += "|";
 base += String(gpio);
 base += "|";
 base += String(millis());
 doc["sig"] = hmacSha256(DEVICE_SECRET, base);
 }

 sendJson(doc);
 Serial.printf("[WS] -> manual_switch: GPIO %d %s -> %s (manual pin %d)\n", gpio, 
 previousState ? "ON" : "OFF", newState ? "ON" : "OFF", sw.manualGpio);
 return;
 }
 }
 Serial.printf("[WS] Manual switch event failed - GPIO %d not found\n", gpio);
}

long getLastSeq(int gpio)
{
 for (auto &p : lastSeqs)
 {
 if (p.gpio == gpio)
 return p.seq;
 }
 return -1;
}

void setLastSeq(int gpio, long seq)
{
 for (auto &p : lastSeqs)
 {
 if (p.gpio == gpio)
 {
 p.seq = seq;
 return;
 }
 }
 lastSeqs.push_back({gpio, seq});
}

void queueSwitchCommand(int gpio, bool state)
{
 Command cmd;
 cmd.gpio = gpio;
 cmd.state = state;
 cmd.valid = true;
 cmd.timestamp = millis();

 if (xQueueSend(cmdQueue, &cmd, 0) != pdTRUE)
 {
 Serial.println("[CMD] Command queue full, dropping command");
 }
 else
 {
 Serial.printf("[CMD] Queued command: GPIO %d -> %s\n", gpio, state ? "ON" : "OFF");
 }
}

void processCommandQueue()
{
 unsigned long now = millis();
 if (now - lastCommandProcess < COMMAND_PROCESS_INTERVAL)
 return;
 lastCommandProcess = now;
 
 // CRASH PREVENTION: Process multiple commands but limit batch size  
 int processedCount = 0;
 const int MAX_BATCH_SIZE = 5; // Process max 5 commands per cycle

 Command cmd;
 while (uxQueueMessagesWaiting(cmdQueue) > 0 && processedCount < MAX_BATCH_SIZE)
 {
 if (xQueueReceive(cmdQueue, &cmd, 0) == pdTRUE)
 {
 if (cmd.valid)
 {
 // CRASH PREVENTION: Add watchdog reset during command processing
 esp_task_wdt_reset();
 
 applySwitchState(cmd.gpio, cmd.state);
 processedCount++;
 
 // Small delay between commands to prevent rapid GPIO changes
 if (processedCount < MAX_BATCH_SIZE && uxQueueMessagesWaiting(cmdQueue) > 0) {
 delay(5); // 5ms between commands
 }
 }
 }
 else
 {
 break; // No more commands
 }
 }
 
 // Log if queue is backing up (potential performance issue)
 UBaseType_t remainingItems = uxQueueMessagesWaiting(cmdQueue);
 if (remainingItems > MAX_COMMAND_QUEUE / 2) {
 Serial.printf("[WARNING] Command queue backing up: %d/%d items\n", 
              remainingItems, MAX_COMMAND_QUEUE);
 }
}

bool applySwitchState(int gpio, bool state)
{
 for (auto &sw : switchesLocal)
 {
 if (sw.gpio == gpio)
 {
 sw.state = state;
 pinMode(sw.gpio, OUTPUT);
 digitalWrite(sw.gpio, state ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
 Serial.printf("[SWITCH] GPIO %d -> %s\n", sw.gpio, state ? "ON" : "OFF");

 // Save state to NVS for offline persistence
 sw.defaultState = state;
 saveConfigToNVS();

 sendStateUpdate(true); // immediate broadcast
 return true;
 }
 }
 Serial.printf("[SWITCH] Unknown GPIO %d (ignored)\n", gpio);
 return false;
}

void loadConfigFromJsonArray(JsonArray arr)
{
 Serial.println("[CONFIG] Loading server configuration...");
 switchesLocal.clear();
 
 for (JsonObject o : arr)
 {
 int g = o["relayGpio"].is<int>() ? o["relayGpio"].as<int>() : (o["gpio"].is<int>() ? o["gpio"].as<int>() : -1);
 if (g < 0)
 continue;
 
 // Server can override safety defaults - this is AUTHORIZED configuration
 bool desiredState = o["state"].is<bool>() ? o["state"].as<bool>() : false;
 
 SwitchState sw{};
 sw.gpio = g;
 sw.state = desiredState;
 sw.defaultState = desiredState; // Store server's desired state as default
 sw.name = String(o["name"].is<const char *>() ? o["name"].as<const char *>() : "");
 sw.manualOverride = false;

 // Manual switch config (optional)
 if (o["manualSwitchEnabled"].is<bool>() && o["manualSwitchEnabled"].as<bool>() && o["manualSwitchGpio"].is<int>())
 {
 sw.manualEnabled = true;
 sw.manualGpio = o["manualSwitchGpio"].as<int>();
 // Parse manualMode (maintained | momentary) and polarity
 if (o["manualMode"].is<const char *>())
 {
 const char *mm = o["manualMode"].as<const char *>();
 sw.manualMomentary = (strcmp(mm, "momentary") == 0);
 }
 if (o["manualActiveLow"].is<bool>())
 {
 sw.manualActiveLow = o["manualActiveLow"].as<bool>();
 }
 }
 
 // Apply server's desired state immediately (this overrides safety defaults)
 pinMode(g, OUTPUT);
 digitalWrite(g, desiredState ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
 Serial.printf("[SERVER-CONFIG] GPIO %d (%s) -> %s (authorized by server)\n", 
 g, sw.name.c_str(), desiredState ? "ON" : "OFF");
 
 if (sw.manualEnabled && sw.manualGpio >= 0)
 {
 // Configure input with proper pull depending on polarity.
 // NOTE: GPIOs 34-39 are input-only and DO NOT support internal pull-up/down.
 // For those pins, we set INPUT and require an external resistor.
 if (sw.manualGpio >= 34 && sw.manualGpio <= 39)
 {
 pinMode(sw.manualGpio, INPUT);
 Serial.printf("[MANUAL][WARN] gpio=%d is input-only (34-39) without internal pull resistors. Use external pull-%s.\n",
 sw.manualGpio, sw.manualActiveLow ? "up to 3.3V" : "down to GND");
 }
 else
 {
 if (sw.manualActiveLow)
 {
 pinMode(sw.manualGpio, INPUT_PULLUP); // active when pulled LOW (to GND)
 }
 else
 {
 // Many ESP32 pins support internal pulldown; if not available, add external pulldown
 pinMode(sw.manualGpio, INPUT_PULLDOWN);
 }
 }
 sw.lastManualLevel = digitalRead(sw.manualGpio);
 sw.stableManualLevel = sw.lastManualLevel;
 // Initialize active logical level after polarity mapping
 sw.lastManualActive = sw.manualActiveLow ? (sw.stableManualLevel == LOW) : (sw.stableManualLevel == HIGH);
 Serial.printf("[MANUAL][INIT] gpio=%d (input %d) activeLow=%d mode=%s raw=%d active=%d\n",
 sw.gpio, sw.manualGpio, sw.manualActiveLow ? 1 : 0,
 sw.manualMomentary ? "momentary" : "maintained",
 sw.stableManualLevel, sw.lastManualActive ? 1 : 0);
 }
 switchesLocal.push_back(sw);
 }
 Serial.printf("[CONFIG] Server configuration loaded: %u switches applied\n", (unsigned)switchesLocal.size());
 
 // Snapshot print for verification
 for (auto &sw : switchesLocal)
 {
 Serial.printf("[SNAPSHOT] gpio=%d state=%s manual=%s manualGpio=%d mode=%s activeLow=%d\n",
 sw.gpio, sw.state ? "ON" : "OFF", sw.manualEnabled ? "yes" : "no", sw.manualGpio,
 sw.manualMomentary ? "momentary" : "maintained", sw.manualActiveLow ? 1 : 0);
 }

 // Save configuration to NVS for offline persistence
 saveConfigToNVS();

 sendStateUpdate(true);
}

// Save configuration to NVS for offline persistence
void saveConfigToNVS()
{
 prefs.begin("switchcfg", false);

 // Save number of switches
 int numSwitches = min((int)switchesLocal.size(), MAX_SWITCHES);
 prefs.putInt("count", numSwitches);

 // Save switch configurations
 for (int i = 0; i < numSwitches; i++)
 {
 prefs.putInt(("gpio" + String(i)).c_str(), switchesLocal[i].gpio);
 prefs.putBool(("state" + String(i)).c_str(), switchesLocal[i].state);
 prefs.putBool(("default" + String(i)).c_str(), switchesLocal[i].defaultState);
 prefs.putBool(("manual_en" + String(i)).c_str(), switchesLocal[i].manualEnabled);
 prefs.putInt(("manual_gpio" + String(i)).c_str(), switchesLocal[i].manualGpio);
 prefs.putBool(("active_low" + String(i)).c_str(), switchesLocal[i].manualActiveLow);
 prefs.putBool(("momentary" + String(i)).c_str(), switchesLocal[i].manualMomentary);
 prefs.putString(("name" + String(i)).c_str(), switchesLocal[i].name);
 prefs.putBool(("override" + String(i)).c_str(), switchesLocal[i].manualOverride);
 }

 // ...existing code...

 prefs.end();

 Serial.println("[NVS] Configuration saved");
}

// Load configuration from NVS for offline persistence
void loadConfigFromNVS()
{
 prefs.begin("switchcfg", true);

 // Check if we have valid data
 int numSwitches = prefs.getInt("count", 0);
 if (numSwitches <= 0 || numSwitches > MAX_SWITCHES)
 {
 Serial.println("[NVS] No valid switch configuration found");
 prefs.end();
 return;
 }

 // Load switch configurations
 switchesLocal.clear();
 for (int i = 0; i < numSwitches; i++)
 {
 SwitchState sw{};
 sw.gpio = prefs.getInt(("gpio" + String(i)).c_str(), -1);
 if (sw.gpio < 0)
 continue; // Skip invalid GPIOs

 // SAFETY: Always load state as OFF for safety, ignore saved states
 // This prevents night activations when server is offline
 bool savedState = prefs.getBool(("state" + String(i)).c_str(), false);
 sw.state = false; // FORCE OFF regardless of saved state
 sw.defaultState = false; // FORCE default to OFF
 
 sw.manualEnabled = prefs.getBool(("manual_en" + String(i)).c_str(), false);
 sw.manualGpio = prefs.getInt(("manual_gpio" + String(i)).c_str(), -1);
 sw.manualActiveLow = prefs.getBool(("active_low" + String(i)).c_str(), true);
 sw.manualMomentary = prefs.getBool(("momentary" + String(i)).c_str(), false);
 sw.name = prefs.getString(("name" + String(i)).c_str(), "Switch " + String(i + 1));
 sw.manualOverride = false; // Reset manual override flag

 // Initialize pins - GPIO already set to OUTPUT and OFF in setupRelays()
 // Don't change pin state here, it was already set to safe OFF
 
 if (sw.manualEnabled && sw.manualGpio >= 0)
 {
 if (sw.manualGpio >= 34 && sw.manualGpio <= 39)
 {
 pinMode(sw.manualGpio, INPUT);
 }
 else
 {
 if (sw.manualActiveLow)
 {
 pinMode(sw.manualGpio, INPUT_PULLUP);
 }
 else
 {
 pinMode(sw.manualGpio, INPUT_PULLDOWN);
 }
 }
 sw.lastManualLevel = digitalRead(sw.manualGpio);
 sw.stableManualLevel = sw.lastManualLevel;
 sw.lastManualActive = sw.manualActiveLow ? (sw.stableManualLevel == LOW) : (sw.stableManualLevel == HIGH);
 }

 switchesLocal.push_back(sw);
 
 Serial.printf("[NVS-SAFETY] Switch %s (GPIO %d) loaded but forced OFF (was %s)\n", 
 sw.name.c_str(), sw.gpio, savedState ? "ON" : "OFF");
 }

 prefs.end();

 Serial.printf("[NVS] Loaded %d switches, all forced to OFF for safety\n", (int)switchesLocal.size());
}

void onWsEvent(WStype_t type, uint8_t *payload, size_t len)
{
 // Reset watchdog at start of WebSocket event processing
 esp_task_wdt_reset();
 
 switch (type)
 {
 case WStype_CONNECTED:
 Serial.println("WS connected");
 identified = false;
 isOfflineMode = false;
 connState = BACKEND_CONNECTED;
 lastWsReconnectAttempt = millis(); // Reset reconnection timer on successful connection
 if (STATUS_LED_PIN != 255)
 digitalWrite(STATUS_LED_PIN, HIGH);
 
 // Immediate identification without delay
 Serial.println("[WS] Sending immediate identification...");
 identify();
 
 // Send latest switch states to backend/UI immediately upon reconnect
 // But don't change physical switch states until server confirms
 sendStateUpdate(true);
 logHealth("WebSocket Connected");
 break;
 case WStype_TEXT:
 {
 // CRASH PREVENTION: Check message size before processing
 if (len > 2048) {
 Serial.printf("[WS] Message too large (%d bytes), ignoring to prevent crash\n", len);
 return;
 }
 
 // CRASH PREVENTION: Use larger JSON buffer and validate allocation
 DynamicJsonDocument doc(1536); // Increased from 1024 to 1536 bytes
 if (doc.capacity() == 0) {
 Serial.println(F("[WS] Failed to allocate JSON memory"));
 reportError("MEMORY", "JSON allocation failed");
 return;
 }
 
 // Use try-catch to prevent crashes from malformed JSON
 try
 {
 DeserializationError jsonError = deserializeJson(doc, payload, len);
 if (jsonError != DeserializationError::Ok)
 {
 Serial.printf("[WS] JSON parse error: %s\n", jsonError.c_str());
 reportError("JSON_PARSE", "Failed to parse WebSocket message");
 return;
 }
 
 // CRASH PREVENTION: Log memory usage
 Serial.printf("[WS] JSON parsed successfully, memory used: %d/%d bytes\n", 
              doc.memoryUsage(), doc.capacity());
 const char *msgType = doc["type"] | "";
 if (strcmp(msgType, "identified") == 0)
 {
 identified = true;
 isOfflineMode = false;
 if (STATUS_LED_PIN != 255)
 digitalWrite(STATUS_LED_PIN, HIGH);
 const char *_mode = doc["mode"].is<const char *>() ? doc["mode"].as<const char *>() : "n/a";
 Serial.printf("[WS] <- identified mode=%s (FAST CONNECTION)\n", _mode);
 
 // Reset per-GPIO sequence tracking on fresh identify to avoid stale_seq after server restarts
 lastSeqs.clear();
 
 // Load configuration immediately for faster response
 if (doc["switches"].is<JsonArray>())
 {
 Serial.println("[WS] Loading server configuration immediately...");
 loadConfigFromJsonArray(doc["switches"].as<JsonArray>());
 Serial.println("[WS] Server configuration applied successfully");
 }
 else
 {
 Serial.println(F("[CONFIG] No switches in identified payload (using safe defaults)"));
 }

 // Send immediate acknowledgment
 Serial.println("[WS] ESP32 ready for commands");
 return;
 }
 if (strcmp(msgType, "config_update") == 0)
 {
 if (doc["switches"].is<JsonArray>())
 {
 Serial.println(F("[WS] <- config_update"));
 // Clear seq tracking as mapping may change
 lastSeqs.clear();
 loadConfigFromJsonArray(doc["switches"].as<JsonArray>());
 }

 // ...existing code...
 return;
 }
 if (strcmp(msgType, "state_ack") == 0)
 {
 bool changed = doc["changed"] | false;
 Serial.printf("[WS] <- state_ack changed=%s\n", changed ? "true" : "false");
 return;
 }
 if (strcmp(msgType, "switch_command") == 0)
 {
 int gpio = doc["relayGpio"].is<int>() ? doc["relayGpio"].as<int>() : (doc["gpio"].is<int>() ? doc["gpio"].as<int>() : -1);
 bool requested = doc["state"] | false;
 long seq = doc["seq"].is<long>() ? doc["seq"].as<long>() : -1;
 Serial.printf("[CMD] Raw: %.*s\n", (int)len, payload);
 Serial.printf("[CMD] switch_command gpio=%d state=%s seq=%ld\n", gpio, requested ? "ON" : "OFF", seq);

 // Queue the command instead of executing immediately
 queueSwitchCommand(gpio, requested);
 return;
 }
 // Bulk switch command support
 if (strcmp(msgType, "bulk_switch_command") == 0)
 {
 Serial.printf("[CMD] bulk_switch_command received\n");
 if (doc["commands"].is<JsonArray>())
 {
 JsonArray cmds = doc["commands"].as<JsonArray>();
 int processed = 0;
 for (JsonObject cmd : cmds)
 {
 int gpio = cmd["relayGpio"].is<int>() ? cmd["relayGpio"].as<int>() : (cmd["gpio"].is<int>() ? cmd["gpio"].as<int>() : -1);
 bool requested = cmd["state"].is<bool>() ? cmd["state"].as<bool>() : false;
 long seq = cmd["seq"].is<long>() ? cmd["seq"].as<long>() : -1;
 if (gpio >= 0)
 {
 queueSwitchCommand(gpio, requested);
 processed++;
 }
 else
 {
 Serial.printf("[CMD] bulk: invalid gpio in command\n");
 }
 }
 Serial.printf("[CMD] bulk_switch_command processed %d commands\n", processed);
 DynamicJsonDocument res(256);
 res["type"] = "bulk_switch_result";
 res["processed"] = processed;
 res["total"] = cmds.size();
 sendJson(res);
 }
 else
 {
 Serial.printf("[CMD] bulk_switch_command missing 'commands' array\n");
 }
 return;
 }
 Serial.printf("[WS] <- unhandled type=%s Raw=%.*s\n", msgType, (int)len, payload);
 }
 catch (const std::exception &e)
 {
 Serial.print("Exception in WebSocket handler: ");
 Serial.println(e.what());
 }
 break;
 }
 case WStype_DISCONNECTED:
 Serial.println("WS disconnected");
 identified = false;
 isOfflineMode = true;
 connState = WIFI_ONLY;
 lastWsReconnectAttempt = millis(); // Reset timer to start reconnection attempts
 if (STATUS_LED_PIN != 255)
 digitalWrite(STATUS_LED_PIN, LOW);
 reportError("WEBSOCKET", "Connection lost");
 Serial.printf("[WS] Will attempt reconnection in %lu seconds\n", WS_RECONNECT_INTERVAL_MS / 1000);
 break;
 default:
 break;
 }
}

void setupRelays()
{
 // SAFETY: Always start with ALL RELAYS OFF regardless of saved states
 // This prevents unwanted activations during night/offline periods
 Serial.println("[SETUP] Initializing all relays to OFF state for safety");
 
 // First initialize pins to safe OFF state
 for (int i = 0; i < MAX_SWITCHES; i++)
 {
 int pin = defaultSwitchConfigs[i].relayPin;
 pinMode(pin, OUTPUT);
 digitalWrite(pin, RELAY_OFF_LEVEL); // FORCE OFF initially
 Serial.printf("[SAFETY] Pin %d forced to OFF\n", pin);
 }
 
 // Small delay to ensure pins are stable
 delay(100);
 
 // Then try to load from NVS but don't apply states yet
 loadConfigFromNVS();
 
 // If no switches loaded, use defaults from config.h
 if (switchesLocal.empty())
 {
 Serial.println("[SETUP] No saved config, using defaults from config.h");
 for (int i = 0; i < MAX_SWITCHES; i++)
 {
 SwitchState sw{};
 sw.gpio = defaultSwitchConfigs[i].relayPin;
 sw.state = false; // Always start OFF
 sw.defaultState = false; // Always default to OFF
 sw.name = defaultSwitchConfigs[i].name;
 sw.manualOverride = false;
 sw.manualEnabled = true;
 sw.manualGpio = defaultSwitchConfigs[i].manualPin;
 sw.manualActiveLow = defaultSwitchConfigs[i].manualActiveLow;
 sw.manualMomentary = false;
 
 // Pin already configured above, just ensure OFF state
 digitalWrite(sw.gpio, RELAY_OFF_LEVEL);
 
 if (sw.manualGpio >= 34 && sw.manualGpio <= 39)
 {
 pinMode(sw.manualGpio, INPUT);
 }
 else
 {
 pinMode(sw.manualGpio, INPUT_PULLUP);
 }
 sw.lastManualLevel = digitalRead(sw.manualGpio);
 sw.stableManualLevel = sw.lastManualLevel;
 sw.lastManualActive = sw.manualActiveLow ? (sw.stableManualLevel == LOW) : (sw.stableManualLevel == HIGH);
 switchesLocal.push_back(sw);
 }
 saveConfigToNVS();
 }
 else
 {
 // Even with saved config, override all states to OFF for safety
 Serial.println("[SETUP] Overriding all saved states to OFF for safety");
 for (auto &sw : switchesLocal)
 {
 pinMode(sw.gpio, OUTPUT);
 // SAFETY OVERRIDE: Ignore saved state, force OFF until server connection
 sw.state = false;
 digitalWrite(sw.gpio, RELAY_OFF_LEVEL);
 Serial.printf("[SAFETY] Switch %s (GPIO %d) forced OFF\n", sw.name.c_str(), sw.gpio);
 }
 }
 
 Serial.println("[SETUP] All switches initialized in safe OFF state");
 Serial.println("[SETUP] Switches will only activate after server connection and explicit commands");
}

// ...existing code...

void blinkStatus()
{
 unsigned long now = millis();
 int pattern = 0;

 switch (connState)
 {
 case WIFI_DISCONNECTED:
 // Fast blink (250ms on, 250ms off)
 pattern = (now % 500) < 250;
 break;
 case WIFI_ONLY:
 // Slow blink (1s on, 1s off) when WiFi connected but no backend
 pattern = (now % 2000) < 1000;
 break;
 case BACKEND_CONNECTED:
 // LED constantly ON when connected to backend
 pattern = 1;
 break;
 }

 if (STATUS_LED_PIN != 255)
 {
 digitalWrite(STATUS_LED_PIN, pattern ? HIGH : LOW);
 }
}

void handleManualSwitches()
{
 unsigned long now = millis();
 
 // OPTIONAL: Add night-time check for manual switches
 // Uncomment the block below if you want to disable manual switches at night
 /*
 struct tm timeinfo;
 if (getLocalTime(&timeinfo)) {
   int hour = timeinfo.tm_hour;
   bool isNightTime = (hour < 6 || hour > 22); // 10 PM to 6 AM
   if (isNightTime) {
     return; // Skip manual switch processing during night hours
   }
 }
 */

 for (auto &sw : switchesLocal)
 {
 if (!sw.manualEnabled || sw.manualGpio < 0)
 continue;

 // Read current level
 int rawLevel = digitalRead(sw.manualGpio);

 // If level changed, start debounce
 if (rawLevel != sw.lastManualLevel)
 {
 sw.lastManualLevel = rawLevel;
 sw.lastManualChangeMs = now;
 }

 // Check if debounce period passed
 if (rawLevel != sw.stableManualLevel && (now - sw.lastManualChangeMs >= MANUAL_DEBOUNCE_MS))
 {
 // Debounced change detected
 sw.stableManualLevel = rawLevel;
 bool active = sw.manualActiveLow ? (rawLevel == LOW) : (rawLevel == HIGH);

 if (sw.manualMomentary)
 {
 // For momentary switches, toggle on active edge
 if (active && !sw.lastManualActive)
 {
 // Toggle on active edge
 bool previousState = sw.state;
 Serial.printf("[MANUAL] Momentary switch GPIO %d (pin %d) pressed - toggling %s -> %s\n", 
 sw.gpio, sw.manualGpio, previousState ? "ON" : "OFF", !previousState ? "ON" : "OFF");
 queueSwitchCommand(sw.gpio, !sw.state);
 sw.manualOverride = true;
 
 // Send manual switch event to backend
 sendManualSwitchEvent(sw.gpio, previousState, !previousState);
 }
 }
 else
 {
 // For maintained switches, follow switch position
 if (active != sw.state)
 {
 bool previousState = sw.state;
 Serial.printf("[MANUAL] Maintained switch GPIO %d (pin %d) changed - %s -> %s\n", 
 sw.gpio, sw.manualGpio, previousState ? "ON" : "OFF", active ? "ON" : "OFF");
 queueSwitchCommand(sw.gpio, active);
 sw.manualOverride = true;
 
 // Send manual switch event to backend
 sendManualSwitchEvent(sw.gpio, previousState, active);
 }
 }

 sw.lastManualActive = active;
 }
 }
}

void setup()
{
 Serial.begin(115200);
 Serial.println("\nESP32 Classroom Automation System Starting...");

 // Initialize command queue
 cmdQueue = xQueueCreate(MAX_COMMAND_QUEUE, sizeof(Command));

 // Setup watchdog timer
 esp_task_wdt_config_t twdt_config = {
 .timeout_ms = WDT_TIMEOUT_MS,
 .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
 .trigger_panic = false // Reset task instead of full system reboot
 };
 // Check if WDT is already initialized
 if (esp_task_wdt_status(NULL) != ESP_OK) {
 esp_task_wdt_init(&twdt_config);
 esp_task_wdt_add(NULL); // Add current task (loopTask)
 }

 // Start in offline mode
 isOfflineMode = true;
 connState = WIFI_DISCONNECTED;

 // Setup relays and load configuration from NVS if available
 setupRelays();

 if (STATUS_LED_PIN != 255)
 {
 pinMode(STATUS_LED_PIN, OUTPUT);
 digitalWrite(STATUS_LED_PIN, LOW);
 }

 // Try to connect to WiFi
 WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
 esp_task_wdt_reset(); // Reset watchdog during WiFi connection
 Serial.print("Connecting to WiFi");

 // Try to connect for 10 seconds, then continue in offline mode if unsuccessful
 unsigned long startAttempt = millis();
 while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000)
 {
 delay(500);
 esp_task_wdt_reset(); // Reset watchdog during connection wait
 Serial.print(".");
 esp_task_wdt_reset(); // Reset watchdog during WiFi connection
 }

 if (WiFi.status() == WL_CONNECTED)
 {
 Serial.println("\nWiFi connected");
 Serial.print("IP: ");
 Serial.println(WiFi.localIP());
 connState = WIFI_ONLY;

 // Configure time
 configTime(0, 0, "pool.ntp.org");

 // Setup WebSocket connection
 ws.begin(BACKEND_HOST, BACKEND_PORT, WS_PATH);
 ws.onEvent(onWsEvent);
 ws.setReconnectInterval(5000);
 isOfflineMode = false;
 }
 else
 {
 Serial.println("\nWiFi connection failed, operating in offline mode");
 isOfflineMode = true;
 }

 lastHeartbeat = millis();
 lastCommandProcess = millis();
 lastWiFiRetry = millis();
 lastHealthCheck = millis();
 lastWsReconnectAttempt = millis(); // Initialize WebSocket reconnection timer

 // Log initial health status
 logHealth("Setup Complete");

 Serial.println("Setup complete!");
}

void loop()
{
 // CRASH PREVENTION: Reset watchdog timer at start of each loop
 esp_task_wdt_reset();
 
 // CRASH PREVENTION: Monitor free heap and take action if getting low
 size_t freeHeap = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);
 if (freeHeap < 40000) { // Less than 40KB free - emergency action
 Serial.printf("[EMERGENCY] Critical memory level: %u bytes. Skipping non-essential operations.\n", freeHeap);
 
 // Skip non-essential operations when memory is critical
 esp_task_wdt_reset();
 delay(100);
 return;
 }

 // Handle WiFi connection
 if (WiFi.status() != WL_CONNECTED)
 {
 connState = WIFI_DISCONNECTED;
 isOfflineMode = true;
 reportError("WIFI", "Connection lost");
 unsigned long now = millis();
 if (now - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS)
 {
 lastWiFiRetry = now;
 // Only retry if not already connecting
 wl_status_t wifiStatus = WiFi.status();
 /* Arduino core does not define WL_CONNECTING, so always retry */
 if (true)
 {
 Serial.println("Retrying WiFi connection...");
 WiFi.disconnect();
 esp_task_wdt_reset(); // Reset watchdog before WiFi operations
 WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
 esp_task_wdt_reset(); // Reset watchdog after WiFi retry
 }
 else
 {
 Serial.println("WiFi is already connecting, skipping WiFi.begin()");
 }
 }
 }
 else
 {
 if (!ws.isConnected())
 {
 connState = WIFI_ONLY;
 isOfflineMode = true;
 unsigned long now = millis();
 
 // Try to reconnect WebSocket if enough time has passed
 if (now - lastWsReconnectAttempt >= WS_RECONNECT_INTERVAL_MS)
 {
 lastWsReconnectAttempt = now;
 Serial.println("[WS] Attempting WebSocket reconnection...");
 esp_task_wdt_reset(); // Reset before WebSocket operations
 ws.disconnect();
 delay(100); // Small delay before reconnecting
 ws.begin(BACKEND_HOST, BACKEND_PORT, WS_PATH);
 ws.onEvent(onWsEvent);
 ws.setReconnectInterval(5000);
 esp_task_wdt_reset(); // Reset after WebSocket setup
 }
 
 // Also try to identify if connection exists but not identified
 if (identified == false && now - lastIdentifyAttempt >= IDENTIFY_RETRY_MS)
 {
 identify();
 }
 }
 else
 {
 connState = BACKEND_CONNECTED;
 isOfflineMode = false;
 }
 }

 // CRASH PREVENTION: Reset watchdog before intensive operations
 esp_task_wdt_reset();

 // Process WebSocket events (can be intensive)
 ws.loop();
 esp_task_wdt_reset(); // Reset watchdog after WebSocket operations

 // Process command queue (with built-in rate limiting)
 processCommandQueue();

 // Handle manual switches
 handleManualSwitches();

 // ...existing code...

 // Send heartbeat
 sendHeartbeat();

 // Update LED status
 blinkStatus();

 // Send pending state updates
 if (pendingState)
 {
 sendStateUpdate(true);
 }

 // Check system health periodically
 checkSystemHealth();

 // Small delay to prevent CPU hogging
 delay(10);
}