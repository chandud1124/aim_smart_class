// -----------------------------------------------------------------------------
// Enhanced ESP32 <-> Backend WebSocket implementation with offline functionality
// Supports operation without WiFi/backend connection and prevents crashes
// Endpoint: ws://<HOST>:3001/esp32-ws (server.js)
//
// NIGHT TIME PROTECTION: Accepts ON commands during night but defers execution
// - Commands are accepted during night time (10 PM - 6 AM)
// - ON commands are stored as pending and executed when daytime arrives
// - OFF commands execute immediately for safety
// - Manual switches are disabled during night time
// - Pending commands survive restarts and execute on daytime detection
//
// COMMAND PRIORITY & PERSISTENCE:
// - Remembers last processed command sequences (survives restarts)
// - Manual overrides take priority over backend commands for 5 seconds
// - Prevents processing of stale/duplicate commands
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
#include <map>
#include "config.h"

// Include our new utility headers
#include "memutils.h"
#include "safe_string.h"
#include "log.h"
#include "rate_limiter.h"
#include "ws_manager.h"

// Uncomment to compile without mbedtls/HMAC (for older cores or minimal builds)
// #define DISABLE_HMAC 1
#ifndef DISABLE_HMAC
#include <mbedtls/md.h>
#endif

#define WIFI_SSID WIFI_SSID
#define WIFI_PASSWORD WIFI_PASSWORD
#define BACKEND_HOST WEBSOCKET_HOST // backend LAN IP
#define BACKEND_PORT WEBSOCKET_PORT
#define WS_PATH WEBSOCKET_PATH
#define HEARTBEAT_MS 30000UL // 30s heartbeat interval
#define DEVICE_SECRET DEVICE_SECRET_KEY // device secret from backend

// Optional status LED (set to 255 to disable if your board lacks LED_BUILTIN)
#ifndef STATUS_LED_PIN
#define STATUS_LED_PIN 2
#endif

// Debounce multiple rapid local state changes into one state_update
#define STATE_DEBOUNCE_MS 200
#define MANUAL_DEBOUNCE_MS 80 // Increased debounce to 80ms for better filtering
#define MANUAL_PRIORITY_MS 5000 // Manual override priority window: 5 seconds
#define MANUAL_REPEAT_IGNORE_MS 200 // Ignore repeated toggles within 200ms

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

// Memory management constants
#define MSG_BUFFER_SIZE 512
#define JSON_BUFFER_SIZE 1536

// Global instances for improved memory management
LogLevel CURRENT_LOG_LEVEL = LOG_DEBUG;
WSManager* g_wsManager = nullptr;
RateLimiter cmdLimiter(1000, 5); // 5 commands per second max
char msgBuffer[MSG_BUFFER_SIZE]; // Reusable message buffer

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

// Add timestamp for last manual override per GPIO
struct ManualOverride
{
 int gpio;
 unsigned long timestamp;
};

// Track recent manual activities for backend synchronization
struct ManualActivity
{
 int gpio;
 bool state;
 unsigned long timestamp;
 String activityType; // "manual_on", "manual_off", "manual_toggle"
};

std::vector<ManualOverride> manualOverrides;
std::vector<ManualActivity> recentManualActivities;

// Pending commands storage for night time deferral (only most recent per GPIO)
std::map<int, Command> pendingNightCommands;

// Night time protection configuration
#define NIGHT_START_HOUR 22  // 10 PM
#define NIGHT_END_HOUR 6     // 6 AM
#define ALLOW_OFF_DURING_NIGHT true  // Allow switches to turn OFF during night
#define PENDING_COMMAND_TIMEOUT_HOURS 12  // Commands expire after 12 hours in pending queue

// Function to check if current time is within night hours
bool isNightTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    // If we can't get time, assume it's not night time for safety
    Serial.println("[NIGHT] Cannot get local time, assuming daytime");
    return false;
  }
  
  int hour = timeinfo.tm_hour;
  bool nightTime = (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR);
  
  if (nightTime) {
    Serial.printf("[NIGHT] Night time protection active (hour: %d, night: %d-%d)\n", 
                  hour, NIGHT_START_HOUR, NIGHT_END_HOUR);
  }
  
  return nightTime;
}

// Function to defer ON command during night time (stores only most recent per GPIO)
void deferNightCommand(int gpio, bool requestedState) {
  if (!isNightTime() || requestedState == false) {
    return; // Only defer ON commands during night time
  }

  // Always replace any existing command for this GPIO with the new one
  Command cmd;
  cmd.gpio = gpio;
  cmd.state = requestedState;
  cmd.valid = true;
  cmd.timestamp = millis();

  pendingNightCommands[gpio] = cmd;  // This will replace any existing command for this GPIO

  Serial.printf("[NIGHT] Stored most recent ON command for GPIO %d (total unique GPIOs: %d)\n",
                gpio, pendingNightCommands.size());

  savePendingCommandsToNVS();

  // Execute the most recent ON command immediately during night time
  Serial.printf("[NIGHT] Executing most recent ON command for GPIO %d during night time\n", gpio);
  queueSwitchCommand(gpio, requestedState);
}

// Function to execute pending night commands when it's daytime (DEPRECATED - no longer used)
// This function is kept for compatibility but pending commands are not executed on startup
// ON commands during night time are now executed immediately when received
void executePendingNightCommands() {
  if (isNightTime() || pendingNightCommands.empty()) {
    return; // Still night time or no pending commands
  }

  Serial.printf("[NIGHT] Checking %d pending night commands for execution...\n", pendingNightCommands.size());

  // Remove expired commands first
  unsigned long currentTime = millis();
  unsigned long timeoutMs = PENDING_COMMAND_TIMEOUT_HOURS * 60 * 60 * 1000UL; // Convert hours to milliseconds

  auto it = pendingNightCommands.begin();
  while (it != pendingNightCommands.end()) {
    if ((currentTime - it->second.timestamp) > timeoutMs) {
      Serial.printf("[NIGHT] Removing expired pending command for GPIO %d (age: %.1f hours)\n",
                    it->first, (currentTime - it->second.timestamp) / (60.0 * 60.0 * 1000.0));
      it = pendingNightCommands.erase(it);
    } else {
      ++it;
    }
  }

  // Save updated list after removing expired commands
  if (!pendingNightCommands.empty()) {
    savePendingCommandsToNVS();
  }

  // NOTE: We don't execute pending commands anymore for safety
  // Commands are executed immediately when received during night time
  if (!pendingNightCommands.empty()) {
    Serial.printf("[NIGHT] %d pending commands found but not executed (safety - relays start OFF)\n", pendingNightCommands.size());
  }
}

// Function to save pending commands to NVS
void savePendingCommandsToNVS() {
  prefs.begin("pendingcmds", false);
  
  int numPending = min((int)pendingNightCommands.size(), MAX_SWITCHES);
  prefs.putInt("pending_count", numPending);
  
  int i = 0;
  for (auto &pair : pendingNightCommands) {
    if (i >= MAX_SWITCHES) break;
    prefs.putInt(("pending_gpio" + String(i)).c_str(), pair.first);
    prefs.putBool(("pending_state" + String(i)).c_str(), pair.second.state);
    prefs.putULong(("pending_ts" + String(i)).c_str(), pair.second.timestamp);
    i++;
  }
  
  prefs.end();
  Serial.printf("[NVS] Saved %d pending commands\n", numPending);
}

// Function to load pending commands from NVS
void loadPendingCommandsFromNVS() {
  prefs.begin("pendingcmds", true);
  
  int numPending = prefs.getInt("pending_count", 0);
  if (numPending > 0 && numPending <= MAX_SWITCHES) {
    pendingNightCommands.clear();
    
    for (int i = 0; i < numPending; i++) {
      int gpio = prefs.getInt(("pending_gpio" + String(i)).c_str(), -1);
      bool state = prefs.getBool(("pending_state" + String(i)).c_str(), false);
      unsigned long timestamp = prefs.getULong(("pending_ts" + String(i)).c_str(), 0);
      
      if (gpio >= 0) {
        Command cmd;
        cmd.gpio = gpio;
        cmd.state = state;
        cmd.valid = true;
        cmd.timestamp = timestamp;
        pendingNightCommands[gpio] = cmd;  // Store in map with GPIO as key
      }
    }
    
    Serial.printf("[NVS] Loaded %d pending commands (will not execute on startup)\n", (int)pendingNightCommands.size());
    
    // DO NOT execute pending commands on startup - relays should start OFF
    // Only execute when daytime arrives naturally during runtime
  } else {
    Serial.println("[NVS] No pending commands found");
  }
  
  prefs.end();
}

// Function to clean up expired pending commands
void cleanupExpiredPendingCommands() {
  if (pendingNightCommands.empty()) {
    return;
  }
  
  unsigned long currentTime = millis();
  unsigned long timeoutMs = PENDING_COMMAND_TIMEOUT_HOURS * 60 * 60 * 1000UL;
  bool hadExpired = false;
  
  auto it = pendingNightCommands.begin();
  while (it != pendingNightCommands.end()) {
    if ((currentTime - it->second.timestamp) > timeoutMs) {
      Serial.printf("[NIGHT] Cleaning up expired pending command for GPIO %d (age: %.1f hours)\n", 
                    it->first, (currentTime - it->second.timestamp) / (60.0 * 60.0 * 1000.0));
      it = pendingNightCommands.erase(it);
      hadExpired = true;
    } else {
      ++it;
    }
  }
  
  if (hadExpired) {
    savePendingCommandsToNVS();
    Serial.printf("[NIGHT] Cleanup complete, %d commands remaining\n", pendingNightCommands.size());
  }
}

// Function to get pending command count for health monitoring
int getPendingCommandCount() {
  return pendingNightCommands.size();
}

// Function to get detailed pending command info for health monitoring
String getPendingCommandInfo() {
  if (pendingNightCommands.empty()) {
    return "None";
  }
  
  String info = "";
  unsigned long currentTime = millis();
  unsigned long timeoutMs = PENDING_COMMAND_TIMEOUT_HOURS * 60 * 60 * 1000UL;
  
  for (auto &pair : pendingNightCommands) {
    int gpio = pair.first;
    Command &cmd = pair.second;
    float ageHours = (currentTime - cmd.timestamp) / (60.0 * 60.0 * 1000.0);
    bool expired = (currentTime - cmd.timestamp) > timeoutMs;
    info += String(gpio) + "(" + (expired ? "EXPIRED" : "VALID") + String(ageHours, 1) + "h),";
  }
  
  // Remove trailing comma
  if (info.length() > 0) {
    info.remove(info.length() - 1);
  }
  
  return info;
}

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
 size_t freeHeap = get_free_heap();
 size_t minFreeHeap = get_min_free_heap();
 UBaseType_t stackHighWaterMark = uxTaskGetStackHighWaterMark(NULL);
 size_t totalHeap = heap_caps_get_total_size(MALLOC_CAP_8BIT);

 LOG_HEALTH(LOG_INFO, "%s | Heap: %u/%u KB (%u KB min) | Stack HWM: %u | Switches: %d | Mode: %s",
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
  LOG_HEALTH(LOG_ERROR, "Very low heap memory: %u bytes free!", freeHeap);

  // Emergency cleanup if memory gets dangerously low
  if (freeHeap < 30000) {
   LOG_HEALTH(LOG_ERROR, "Attempting memory cleanup...");
   // Force garbage collection if available
   heap_caps_check_integrity_all(true);
  }
 }
 else if (freeHeap < 80000)
 { // Less than 80KB free - WARNING
  LOG_HEALTH(LOG_WARN, "Heap memory getting low: %u bytes free", freeHeap);
 }

 // Warning if stack is getting low
 if (stackHighWaterMark < 1024)
 { // Less than 1KB stack remaining
  LOG_HEALTH(LOG_WARN, "Low stack space: %u bytes remaining!", stackHighWaterMark);
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
  LOG_HEALTH(LOG_WARN, "WiFi disconnected!");
 }
 else
 {
  LOG_HEALTH(LOG_INFO, "WiFi connected, IP: %s", WiFi.localIP().toString().c_str());
 }

 if (!g_wsManager || !g_wsManager->isConnected())
 {
  LOG_HEALTH(LOG_WARN, "WebSocket disconnected!");
 }
 else
 {
  LOG_HEALTH(LOG_INFO, "WebSocket connected, identified: %s", identified ? "YES" : "NO");
 }

 // Check command queue health
 UBaseType_t queueItems = uxQueueMessagesWaiting(cmdQueue);
 if (queueItems > MAX_COMMAND_QUEUE / 2)
 {
  LOG_HEALTH(LOG_WARN, "Command queue getting full: %d/%d items", queueItems, MAX_COMMAND_QUEUE);
 }

 // Check rate limiter status
 LOG_HEALTH(LOG_DEBUG, "Rate limiter tokens: %d/%d", cmdLimiter.getTokens(), cmdLimiter.getCapacity());

 // Check switch states for anomalies
 int activeSwitches = 0;
 for (auto &sw : switchesLocal)
 {
 if (sw.state)
 activeSwitches++;
 }
 if (activeSwitches > switchesLocal.size() / 2)
 {
  LOG_HEALTH(LOG_WARN, "Many switches active: %d/%d", activeSwitches, switchesLocal.size());
 }

 // NIGHT TIME STATUS: Log current time and night time protection status
 struct tm timeinfo;
 if (getLocalTime(&timeinfo)) {
   LOG_HEALTH(LOG_INFO, "Current time: %02d:%02d:%02d, Night protection: %s, Pending commands: %d [%s]",
              timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec,
              isNightTime() ? "ACTIVE (deferred ON, immediate OFF)" : "INACTIVE (immediate execution, store OFF)",
              getPendingCommandCount(), getPendingCommandInfo().c_str());
 } else {
   LOG_HEALTH(LOG_WARN, "Time not available, night protection may not work");
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
 if (!g_wsManager || !g_wsManager->isConnected())
 {
  LOG_WS(LOG_WARN, "Cannot send: WebSocket not connected");
  return;
 }

 // Use fixed-size buffer instead of String for serialization
 size_t jsonSize = measureJson(doc);
 if (jsonSize >= MSG_BUFFER_SIZE) {
  LOG_WS(LOG_ERROR, "JSON too large for buffer: %d bytes", jsonSize);
  return;
 }

 serializeJson(doc, msgBuffer, MSG_BUFFER_SIZE);
 bool result = g_wsManager->sendTXT(msgBuffer);
 if (!result) {
  LOG_WS(LOG_ERROR, "Failed to send WebSocket message");
 }
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

 // Use fixed buffer instead of String concatenation
 char hmacStr[65];
 for (int i = 0; i < 32; i++)
 sprintf(&hmacStr[i * 2], "%02x", hmacResult[i]);
 hmacStr[64] = '\0';

 return String(hmacStr);
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
 Serial.println("[WS] Sent identification to backend");
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

 if (g_wsManager && g_wsManager->isConnected())
 {
 DynamicJsonDocument doc(256);
 doc["type"] = "heartbeat";
 doc["mac"] = WiFi.macAddress();
 doc["uptime"] = millis() / 1000;
 doc["offline_mode"] = isOfflineMode;
 sendJson(doc);
 LOG_WS(LOG_INFO, "-> heartbeat");
 }
}

void sendManualSwitchEvent(int gpio, bool previousState, bool newState)
{
 // Don't send if not connected
 if (!g_wsManager || !g_wsManager->isConnected())
 {
  LOG_WS(LOG_WARN, "Cannot send manual switch event - not connected");
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
 // Use fixed buffer for GPIO string conversion
 char gpioStr[16];
 safe_snprintf(gpioStr, sizeof(gpioStr), "%d", gpio);
 doc["switchId"] = gpioStr;
 doc["gpio"] = gpio;
 doc["action"] = newState ? "manual_on" : "manual_off";
 doc["previousState"] = previousState ? "on" : "off";
 doc["newState"] = newState ? "on" : "off";
 doc["detectedBy"] = "gpio_interrupt";
 doc["responseTime"] = millis() % 1000; // Simple response time simulation
 doc["physicalPin"] = sw.manualGpio;
 doc["timestamp"] = millis();

 if (strlen(DEVICE_SECRET) > 0)
 {
 // Use fixed buffer for HMAC base string
 char hmacBase[128];
 safe_snprintf(hmacBase, sizeof(hmacBase), "%s|%d|%ld",
               WiFi.macAddress().c_str(), gpio, (long)millis());
 String sig = hmacSha256(DEVICE_SECRET, hmacBase);
 doc["sig"] = sig;
 }

 sendJson(doc);
 LOG_WS(LOG_INFO, "-> manual_switch: GPIO %d %s -> %s (manual pin %d)",
         gpio, previousState ? "ON" : "OFF", newState ? "ON" : "OFF", sw.manualGpio);
 return;
 }
 }
 LOG_WS(LOG_ERROR, "Manual switch event failed - GPIO %d not found", gpio);
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
 saveSequenceDataToNVS(); // Save to NVS when sequence changes
 return;
 }
 }
 lastSeqs.push_back({gpio, seq});
 saveSequenceDataToNVS(); // Save to NVS when new sequence added
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
  LOG_CMD(LOG_ERROR, "Command queue full, dropping command");
 }
 else
 {
  LOG_CMD(LOG_DEBUG, "Queued command: GPIO %d -> %s", gpio, state ? "ON" : "OFF");
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
 // RATE LIMITING: Check if we can process this command
 if (!cmdLimiter.allow()) {
  LOG_CMD(LOG_WARN, "Command rate limited - GPIO %d", cmd.gpio);
  // Re-queue the command for later processing
  if (xQueueSendToFront(cmdQueue, &cmd, 0) != pdTRUE) {
   LOG_CMD(LOG_ERROR, "Failed to re-queue rate limited command for GPIO %d", cmd.gpio);
  }
  break; // Stop processing to avoid overwhelming the rate limiter
 }

 // CRASH PREVENTION: Add watchdog reset during command processing
 esp_task_wdt_reset();

 // Log command processing for debugging
 LOG_CMD(LOG_DEBUG, "Processing queued command: GPIO %d -> %s", cmd.gpio, cmd.state ? "ON" : "OFF");

 bool success = applySwitchState(cmd.gpio, cmd.state);
 if (!success) {
  LOG_CMD(LOG_ERROR, "Failed to apply command for GPIO %d", cmd.gpio);
 }
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
  LOG_CMD(LOG_WARN, "Command queue backing up: %d/%d items", remainingItems, MAX_COMMAND_QUEUE);
 }

 // Log successful processing
 if (processedCount > 0) {
  LOG_CMD(LOG_DEBUG, "Processed %d commands this cycle", processedCount);
 }
}

bool applySwitchState(int gpio, bool state)
{
 // Validate GPIO pin
 if (gpio < 0 || gpio > 39) {
  LOG_CMD(LOG_ERROR, "Invalid GPIO %d (must be 0-39)", gpio);
  return false;
 }

 for (auto &sw : switchesLocal)
 {
 if (sw.gpio == gpio)
 {
 // Check if pin is properly configured
 if (!digitalPinIsValid(sw.gpio)) {
  LOG_CMD(LOG_ERROR, "GPIO %d is not a valid digital pin", sw.gpio);
  return false;
 }

 sw.state = state;
 pinMode(sw.gpio, OUTPUT);
 digitalWrite(sw.gpio, state ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
 LOG_CMD(LOG_INFO, "GPIO %d -> %s (SUCCESS)", sw.gpio, state ? "ON" : "OFF");

 // Save state to NVS for offline persistence
 sw.defaultState = state;
 saveConfigToNVS();

 sendStateUpdate(true); // immediate broadcast
 return true;
 }
 }
 LOG_CMD(LOG_ERROR, "Unknown GPIO %d (not found in switchesLocal)", gpio);
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
// Function to save sequence tracking data to NVS
void saveSequenceDataToNVS()
{
 prefs.begin("seqdata", false);
 
 // Save number of sequences
 int numSeqs = min((int)lastSeqs.size(), MAX_SWITCHES);
 prefs.putInt("seq_count", numSeqs);
 
 // Save sequence data
 for (int i = 0; i < numSeqs; i++)
 {
  prefs.putInt(("seq_gpio" + String(i)).c_str(), lastSeqs[i].gpio);
  prefs.putLong(("seq_val" + String(i)).c_str(), lastSeqs[i].seq);
 }
 
 prefs.end();
 Serial.printf("[NVS] Saved %d sequence entries\n", numSeqs);
}

// Function to load sequence tracking data from NVS
void loadSequenceDataFromNVS()
{
 prefs.begin("seqdata", true);
 
 int numSeqs = prefs.getInt("seq_count", 0);
 if (numSeqs > 0 && numSeqs <= MAX_SWITCHES)
 {
  lastSeqs.clear();
  for (int i = 0; i < numSeqs; i++)
  {
   int gpio = prefs.getInt(("seq_gpio" + String(i)).c_str(), -1);
   long seq = prefs.getLong(("seq_val" + String(i)).c_str(), -1);
   if (gpio >= 0 && seq >= 0)
   {
    lastSeqs.push_back({gpio, seq});
   }
  }
  Serial.printf("[NVS] Loaded %d sequence entries\n", (int)lastSeqs.size());
 }
 else
 {
  Serial.println("[NVS] No valid sequence data found");
 }
 
 prefs.end();
}

// Function to add a recent manual activity
void addManualActivity(int gpio, bool state, String activityType) {
  ManualActivity activity;
  activity.gpio = gpio;
  activity.state = state;
  activity.timestamp = millis();
  activity.activityType = activityType;
  
  // Keep only the most recent activity per GPIO (replace if exists)
  for (auto it = recentManualActivities.begin(); it != recentManualActivities.end(); ++it) {
    if (it->gpio == gpio) {
      *it = activity; // Replace existing activity
      Serial.printf("[MANUAL] Updated recent activity for GPIO %d: %s\n", gpio, activityType.c_str());
      saveRecentManualActivitiesToNVS();
      return;
    }
  }
  
  // Add new activity if GPIO not found
  recentManualActivities.push_back(activity);
  
  // Limit the number of stored activities to prevent memory issues
  if (recentManualActivities.size() > MAX_SWITCHES) {
    recentManualActivities.erase(recentManualActivities.begin()); // Remove oldest
  }
  
  Serial.printf("[MANUAL] Added recent activity for GPIO %d: %s (total: %d)\n", 
                gpio, activityType.c_str(), recentManualActivities.size());
  
  saveRecentManualActivitiesToNVS();
}

// Function to save recent manual activities to NVS
void saveRecentManualActivitiesToNVS() {
  prefs.begin("manualact", false);
  
  int numActivities = min((int)recentManualActivities.size(), MAX_SWITCHES);
  prefs.putInt("activity_count", numActivities);
  
  for (int i = 0; i < numActivities; i++) {
    prefs.putInt(("act_gpio" + String(i)).c_str(), recentManualActivities[i].gpio);
    prefs.putBool(("act_state" + String(i)).c_str(), recentManualActivities[i].state);
    prefs.putULong(("act_ts" + String(i)).c_str(), recentManualActivities[i].timestamp);
    prefs.putString(("act_type" + String(i)).c_str(), recentManualActivities[i].activityType);
  }
  
  prefs.end();
  Serial.printf("[NVS] Saved %d recent manual activities\n", numActivities);
}

// Function to load recent manual activities from NVS
void loadRecentManualActivitiesFromNVS() {
  prefs.begin("manualact", true);
  
  int numActivities = prefs.getInt("activity_count", 0);
  if (numActivities > 0 && numActivities <= MAX_SWITCHES) {
    recentManualActivities.clear();
    
    for (int i = 0; i < numActivities; i++) {
      int gpio = prefs.getInt(("act_gpio" + String(i)).c_str(), -1);
      bool state = prefs.getBool(("act_state" + String(i)).c_str(), false);
      unsigned long timestamp = prefs.getULong(("act_ts" + String(i)).c_str(), 0);
      String activityType = prefs.getString(("act_type" + String(i)).c_str(), "");
      
      if (gpio >= 0 && !activityType.isEmpty()) {
        ManualActivity activity;
        activity.gpio = gpio;
        activity.state = state;
        activity.timestamp = timestamp;
        activity.activityType = activityType;
        recentManualActivities.push_back(activity);
      }
    }
    
    Serial.printf("[NVS] Loaded %d recent manual activities\n", (int)recentManualActivities.size());
  } else {
    Serial.println("[NVS] No recent manual activities found");
  }
  
  prefs.end();
}

// Function to send recent manual activities to backend on reconnection
void sendRecentManualActivitiesToBackend() {
  if (!ws.isConnected() || recentManualActivities.empty()) {
    return;
  }
  
  Serial.printf("[SYNC] Sending %d recent manual activities to backend...\n", recentManualActivities.size());
  
  for (const auto& activity : recentManualActivities) {
    // Find the switch to get its details
    for (auto &sw : switchesLocal) {
      if (sw.gpio == activity.gpio) {
        DynamicJsonDocument doc(512);
        doc["type"] = "manual_switch_sync";
        doc["mac"] = WiFi.macAddress();
        doc["switchId"] = String(activity.gpio);
        doc["gpio"] = activity.gpio;
        doc["action"] = activity.activityType;
        doc["currentState"] = activity.state ? "on" : "off";
        doc["detectedBy"] = "gpio_interrupt";
        doc["timestamp"] = activity.timestamp;
        doc["sync_reason"] = "recent_activity";

        if (strlen(DEVICE_SECRET) > 0) {
          String base = WiFi.macAddress();
          base += "|";
          base += String(activity.gpio);
          base += "|";
          base += String(activity.timestamp);
          doc["sig"] = hmacSha256(DEVICE_SECRET, base);
        }

        sendJson(doc);
        Serial.printf("[SYNC] -> manual_switch_sync: GPIO %d %s (state: %s)\n", 
                      activity.gpio, activity.activityType.c_str(), activity.state ? "ON" : "OFF");
        break;
      }
    }
  }
  
  // Clear activities after sending (they've been synchronized)
  recentManualActivities.clear();
  saveRecentManualActivitiesToNVS();
  Serial.println("[SYNC] Recent manual activities sent and cleared");
}

// Function to check if there's a recent manual activity for a GPIO
bool hasRecentManualActivity(int gpio) {
  for (const auto& activity : recentManualActivities) {
    if (activity.gpio == gpio) {
      return true;
    }
  }
  return false;
}

// Function to get the most recent manual activity state for a GPIO
bool getRecentManualActivityState(int gpio) {
  for (const auto& activity : recentManualActivities) {
    if (activity.gpio == gpio) {
      return activity.state;
    }
  }
  return false; // Default to OFF if not found
}

// Function to load manual override timestamps from NVS
void loadManualOverridesFromNVS()
{
 prefs.begin("manualdata", true);
 
 int numOverrides = prefs.getInt("override_count", 0);
 if (numOverrides > 0 && numOverrides <= MAX_SWITCHES)
 {
  manualOverrides.clear();
  unsigned long currentTime = millis();
  
  for (int i = 0; i < numOverrides; i++)
  {
   int gpio = prefs.getInt(("override_gpio" + String(i)).c_str(), -1);
   unsigned long timestamp = prefs.getULong(("override_ts" + String(i)).c_str(), 0);
   
   if (gpio >= 0 && timestamp > 0)
   {
    // Only load overrides that are still within the priority window
    if ((currentTime - timestamp) < MANUAL_PRIORITY_MS)
    {
     manualOverrides.push_back({gpio, timestamp});
    }
    else
    {
     Serial.printf("[NVS] Skipping expired manual override for GPIO %d\n", gpio);
    }
   }
  }
  Serial.printf("[NVS] Loaded %d valid manual override entries\n", (int)manualOverrides.size());
 }
 else
 {
  Serial.println("[NVS] No valid manual override data found");
 }
 
 prefs.end();
}

// Function to check if there's a recent manual override for a GPIO
bool isManualOverrideRecent(int gpio)
{
 unsigned long currentTime = millis();
 for (auto &override : manualOverrides)
 {
  if (override.gpio == gpio)
  {
   if ((currentTime - override.timestamp) < MANUAL_PRIORITY_MS)
   {
    return true;
   }
   else
   {
    // Remove expired override
    auto it = std::find(manualOverrides.begin(), manualOverrides.end(), override);
    if (it != manualOverrides.end())
    {
     manualOverrides.erase(it);
     Serial.printf("[OVERRIDE] Removed expired manual override for GPIO %d\n", gpio);
    }
    return false;
   }
  }
 }
 return false;
}

// Function to set a manual override timestamp for a GPIO
void setManualOverride(int gpio)
{
 unsigned long currentTime = millis();
 
 // Update existing override or add new one
 for (auto &override : manualOverrides)
 {
  if (override.gpio == gpio)
  {
   override.timestamp = currentTime;
   Serial.printf("[OVERRIDE] Updated manual override timestamp for GPIO %d\n", gpio);
   saveManualOverridesToNVS();
   return;
  }
 }
 
 // Add new override
 manualOverrides.push_back({gpio, currentTime});
 
 // Limit the number of stored overrides to prevent memory issues
 if (manualOverrides.size() > MAX_SWITCHES)
 {
  manualOverrides.erase(manualOverrides.begin()); // Remove oldest
 }
 
 Serial.printf("[OVERRIDE] Added manual override for GPIO %d (total: %d)\n", gpio, manualOverrides.size());
 saveManualOverridesToNVS();
}

// Function to save manual override timestamps to NVS
void saveManualOverridesToNVS()
{
 prefs.begin("manualdata", false);
 
 int numOverrides = min((int)manualOverrides.size(), MAX_SWITCHES);
 prefs.putInt("override_count", numOverrides);
 
 for (int i = 0; i < numOverrides; i++)
 {
  prefs.putInt(("override_gpio" + String(i)).c_str(), manualOverrides[i].gpio);
  prefs.putULong(("override_ts" + String(i)).c_str(), manualOverrides[i].timestamp);
 }
 
 prefs.end();
 Serial.printf("[NVS] Saved %d manual override entries\n", numOverrides);
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
  prefs.putBool(("manual_en" + String(i)).c_str(), switchesLocal[i].manualEnabled);
  prefs.putInt(("manual_gpio" + String(i)).c_str(), switchesLocal[i].manualGpio);
  prefs.putBool(("active_low" + String(i)).c_str(), switchesLocal[i].manualActiveLow);
  prefs.putBool(("momentary" + String(i)).c_str(), switchesLocal[i].manualMomentary);
  prefs.putString(("name" + String(i)).c_str(), switchesLocal[i].name);
 }
 
 prefs.end();
 Serial.printf("[NVS] Saved %d switches\n", numSwitches);
}

void onWsEvent(WStype_t type, uint8_t *payload, size_t len)
{
 // Reset watchdog at start of WebSocket event processing
 esp_task_wdt_reset();
 
 switch (type)
 {
 case WStype_CONNECTED:
  LOG_WS(LOG_INFO, "WebSocket connected");
  identified = false;
  isOfflineMode = false;
  connState = BACKEND_CONNECTED;
  lastWsReconnectAttempt = millis(); // Reset reconnection timer on successful connection
  if (STATUS_LED_PIN != 255)
  digitalWrite(STATUS_LED_PIN, HIGH);

  // Immediate identification without delay
  LOG_WS(LOG_INFO, "Sending immediate identification...");
  identify();

  // Send latest switch states to backend/UI immediately upon reconnect
  // But don't change physical switch states until server confirms
  sendStateUpdate(true);

  // Send recent manual activities to backend for UI synchronization
  sendRecentManualActivitiesToBackend();

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

 // Validate command parameters
 if (gpio < 0) {
 Serial.printf("[CMD] Invalid GPIO %d in switch_command\n", gpio);
 return;
 }

 // SEQUENCE VALIDATION: Check if this command is newer than the last processed command
 if (seq > 0) {
  long lastSeq = getLastSeq(gpio);
  if (lastSeq > 0 && seq <= lastSeq) {
   Serial.printf("[CMD] Ignoring stale command for GPIO %d (seq %ld <= last %ld)\n", gpio, seq, lastSeq);
   return;
  }
  // Update sequence tracking for this GPIO
  setLastSeq(gpio, seq);
 }

 // NIGHT TIME PROTECTION: Handle ON/OFF commands differently based on time
 if (isNightTime()) {
   if (requested) {
     // During night time: Accept ON commands but defer them (store and execute most recent)
     Serial.printf("[NIGHT] Accepting but deferring ON command for GPIO %d during night time\n", gpio);
     deferNightCommand(gpio, requested);
     return; // Don't execute immediately
   } else {
     // OFF commands during night time: Execute immediately
     Serial.printf("[NIGHT] Executing OFF command for GPIO %d during night time\n", gpio);
   }
 } else {
   if (!requested) {
     // During day time: Store OFF commands as recent for logging/sync
     Serial.printf("[DAY] Storing OFF command for GPIO %d as recent during day time\n", gpio);
     addManualActivity(gpio, requested, "backend_off");
   } else {
     // ON commands during day time: Execute immediately
     Serial.printf("[DAY] Executing ON command for GPIO %d during day time\n", gpio);
   }
 }

 // COMMAND PRIORITY: Check if there's a recent manual override for this GPIO
 if (isManualOverrideRecent(gpio)) {
 Serial.printf("[CMD] Ignoring backend command for GPIO %d - recent manual override active\n", gpio);
 return;
 }

 // Queue the command for execution (immediate for day time, deferred for night ON commands)
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
  // SEQUENCE VALIDATION: Check if this command is newer than the last processed command
  if (seq > 0) {
   long lastSeq = getLastSeq(gpio);
   if (lastSeq > 0 && seq <= lastSeq) {
    Serial.printf("[CMD] bulk: Ignoring stale command for GPIO %d (seq %ld <= last %ld)\n", gpio, seq, lastSeq);
    continue; // Skip this command
   }
   // Update sequence tracking for this GPIO
   setLastSeq(gpio, seq);
  }

  // NIGHT TIME PROTECTION: Handle ON/OFF commands differently based on time
  if (isNightTime()) {
    if (requested) {
      // During night time: Accept ON commands but defer them (store and execute most recent)
      Serial.printf("[NIGHT] Bulk: Accepting but deferring ON command for GPIO %d during night time\n", gpio);
      deferNightCommand(gpio, requested);
      continue; // Don't execute immediately
    } else {
      // OFF commands during night time: Execute immediately
      Serial.printf("[NIGHT] Bulk: Executing OFF command for GPIO %d during night time\n", gpio);
    }
  } else {
    if (!requested) {
      // During day time: Store OFF commands as recent for logging/sync
      Serial.printf("[DAY] Bulk: Storing OFF command for GPIO %d as recent during day time\n", gpio);
      addManualActivity(gpio, requested, "backend_off");
    } else {
      // ON commands during day time: Execute immediately
      Serial.printf("[DAY] Bulk: Executing ON command for GPIO %d during day time\n", gpio);
    }
  }

  // COMMAND PRIORITY: Check if there's a recent manual override for this GPIO
  if (isManualOverrideRecent(gpio)) {
   Serial.printf("[CMD] bulk: Ignoring backend command for GPIO %d - recent manual override active\n", gpio);
   continue; // Skip this command
  }

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
  LOG_WS(LOG_WARN, "WebSocket disconnected");
  identified = false;
  isOfflineMode = true;
  connState = WIFI_ONLY;
  lastWsReconnectAttempt = millis(); // Reset timer to start reconnection attempts
  if (STATUS_LED_PIN != 255)
  digitalWrite(STATUS_LED_PIN, LOW);
  LOG_WS(LOG_INFO, "Will attempt reconnection in %lu seconds", WS_RECONNECT_INTERVAL_MS / 1000);
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
 
 // MANUAL SWITCHES: Always enabled (including during night time)
 // Note: Manual switches can override night time restrictions for immediate control

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

     // Prevent repeated toggles within MANUAL_REPEAT_IGNORE_MS
     static unsigned long lastManualTriggerMs[MAX_SWITCHES] = {0};
     int swIdx = &sw - &switchesLocal[0];
     if (swIdx >= 0 && swIdx < MAX_SWITCHES) {
       if (now - lastManualTriggerMs[swIdx] < MANUAL_REPEAT_IGNORE_MS) {
         // Ignore repeated toggles
         Serial.printf("[MANUAL] Ignored repeated toggle for GPIO %d within %d ms\n", sw.gpio, MANUAL_REPEAT_IGNORE_MS);
         sw.lastManualActive = active;
         continue;
       }
       lastManualTriggerMs[swIdx] = now;
     }

     if (sw.manualMomentary)
     {
       // For momentary switches, toggle on active edge
       if (active && !sw.lastManualActive)
       {
         // Toggle on active edge
         bool previousState = sw.state;
         bool newState = !sw.state;
         Serial.printf("[MANUAL] Momentary switch GPIO %d (pin %d) pressed - toggling %s -> %s\n", 
           sw.gpio, sw.manualGpio, previousState ? "ON" : "OFF", newState ? "ON" : "OFF");
         queueSwitchCommand(sw.gpio, newState);
         sw.manualOverride = true;
         setManualOverride(sw.gpio); // Set timestamp for manual override priority
         
         // Track manual activity for backend synchronization
         String activityType = newState ? "manual_on" : "manual_off";
         addManualActivity(sw.gpio, newState, activityType);
         
         // Send manual switch event to backend
         sendManualSwitchEvent(sw.gpio, previousState, newState);
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
         setManualOverride(sw.gpio); // Set timestamp for manual override priority
         
         // Track manual activity for backend synchronization
         String activityType = active ? "manual_on" : "manual_off";
         addManualActivity(sw.gpio, active, activityType);
         
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
 LOGI("ESP32 Classroom Automation System Starting...");

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

 // Load persistent sequence and manual override data
 loadSequenceDataFromNVS();
 loadManualOverridesFromNVS();
 loadPendingCommandsFromNVS();
 loadRecentManualActivitiesFromNVS();

 if (STATUS_LED_PIN != 255)
 {
 pinMode(STATUS_LED_PIN, OUTPUT);
 digitalWrite(STATUS_LED_PIN, LOW);
 }

 // Try to connect to WiFi
 WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
 esp_task_wdt_reset(); // Reset watchdog during WiFi connection
 LOGI("Connecting to WiFi");

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
 LOGI("WiFi connected");
 LOGI("IP: %s", WiFi.localIP().toString().c_str());
 connState = WIFI_ONLY;

 // Configure time
 configTime(0, 0, "pool.ntp.org");

 // Setup WebSocket connection using new manager
 g_wsManager = new WSManager(BACKEND_HOST, BACKEND_PORT, WS_PATH);
 g_wsManager->setMessageCallback([](uint8_t* payload, size_t length) {
   // Forward WebSocket messages to the existing handler
   onWsEvent(WStype_TEXT, payload, length);
 });
 g_wsManager->begin();
 isOfflineMode = false;
 }
 else
 {
 LOGW("WiFi connection failed, operating in offline mode");
 isOfflineMode = true;
 }

 lastHeartbeat = millis();
 lastCommandProcess = millis();
 lastWiFiRetry = millis();
 lastHealthCheck = millis();
 lastWsReconnectAttempt = millis(); // Initialize WebSocket reconnection timer

 // Log initial health status
 logHealth("Setup Complete");

 LOGI("Setup complete!");
}

void loop()
{
 // CRASH PREVENTION: Reset watchdog timer at start of each loop
 esp_task_wdt_reset();

 // CRASH PREVENTION: Monitor free heap and take action if getting low
 size_t freeHeap = get_free_heap();
 if (freeHeap < 40000) { // Less than 40KB free - emergency action
  LOG_MEM(LOG_ERROR, "Critical memory level: %u bytes free. Skipping non-essential operations.", freeHeap);

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
 LOG_WS(LOG_ERROR, "WiFi connection lost");
 unsigned long now = millis();
 if (now - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS)
 {
 lastWiFiRetry = now;
 // Only retry if not already connecting
 wl_status_t wifiStatus = WiFi.status();
 /* Arduino core does not define WL_CONNECTING, so always retry */
 if (true)
 {
  LOGI("Retrying WiFi connection...");
  WiFi.disconnect();
  esp_task_wdt_reset(); // Reset watchdog before WiFi operations
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  esp_task_wdt_reset(); // Reset watchdog after WiFi retry
 }
 else
 {
  LOGI("WiFi is already connecting, skipping WiFi.begin()");
 }
 }
 }
 else
 {
 if (g_wsManager && !g_wsManager->isConnected())
 {
 connState = WIFI_ONLY;
 isOfflineMode = true;
 unsigned long now = millis();

 // Try to reconnect WebSocket if enough time has passed
 if (now - lastWsReconnectAttempt >= WS_RECONNECT_INTERVAL_MS)
 {
 lastWsReconnectAttempt = now;
 LOG_WS(LOG_INFO, "Attempting WebSocket reconnection...");
 esp_task_wdt_reset(); // Reset before WebSocket operations
 g_wsManager->disconnect();
 delay(100); // Small delay before reconnecting
 // WebSocket manager handles reconnection automatically
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
 if (g_wsManager) {
   g_wsManager->loop();
 }
 esp_task_wdt_reset(); // Reset watchdog after WebSocket operations

 // Process command queue (with built-in rate limiting)
 processCommandQueue();

 // Debug: Log queue status periodically
 static unsigned long lastQueueDebug = 0;
 unsigned long now = millis();
 if (now - lastQueueDebug >= 5000) { // Every 5 seconds
 UBaseType_t queueItems = uxQueueMessagesWaiting(cmdQueue);
 if (queueItems > 0) {
  LOG_CMD(LOG_DEBUG, "Command queue has %d items waiting", queueItems);
 }
 lastQueueDebug = now;
 }

 // Handle manual switches
 handleManualSwitches();

 // Check for pending night commands (for cleanup only - no execution for safety)
 // This check is kept for compatibility but pending commands are not executed
 static unsigned long lastPendingCheck = 0;
 unsigned long now = millis();
 if (now - lastPendingCheck >= 60000) { // Check every minute
   executePendingNightCommands(); // This will only clean up expired commands, not execute them
   cleanupExpiredPendingCommands();  // Clean up expired commands
   lastPendingCheck = now;
 }

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

 // Periodic memory monitoring
 static unsigned long lastMemLog = 0;
 if (millis() - lastMemLog > 10000) { // Every 10 seconds
   lastMemLog = millis();
   LOG_MEM(LOG_DEBUG, "Free heap: %u bytes", get_free_heap());
 }

 // Small delay to prevent CPU hogging
 delay(10);
}