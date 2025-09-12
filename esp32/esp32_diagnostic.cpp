// ESP32 Diagnostic and Crash Prevention Tool
// This is a simplified diagnostic version to help identify crash causes

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_task_wdt.h>

// Diagnostic mode - uncomment to enable various debugging features
#define ENABLE_MEMORY_DIAGNOSTICS 1
#define ENABLE_STACK_MONITORING 1
#define ENABLE_TASK_MONITORING 1
#define ENABLE_JSON_SIZE_MONITORING 1

#define WIFI_SSID "AIMS-WIFI"
#define WIFI_PASSWORD "Aimswifi#2025"
#define BACKEND_HOST "172.16.3.171"
#define BACKEND_PORT 3001
#define WS_PATH "/esp32-ws"

WebSocketsClient ws;
unsigned long lastDiagnosticReport = 0;
const unsigned long DIAGNOSTIC_INTERVAL = 5000; // Report every 5 seconds

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("ESP32 Diagnostic Tool Starting...");
  Serial.println("=====================================");
  
  // Initialize watchdog with longer timeout for diagnostics
  esp_task_wdt_config_t twdt_config = {
    .timeout_ms = 60000, // 60 seconds for diagnostics
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic = false
  };
  
  if (esp_task_wdt_status(NULL) != ESP_OK) {
    esp_task_wdt_init(&twdt_config);
    esp_task_wdt_add(NULL);
  }
  
  reportSystemInfo();
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  
  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 15000) {
    delay(500);
    Serial.print(".");
    esp_task_wdt_reset();
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected successfully!");
    Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Signal strength: %d dBm\n", WiFi.RSSI());
    
    // Setup WebSocket with diagnostics
    ws.begin(BACKEND_HOST, BACKEND_PORT, WS_PATH);
    ws.onEvent(onWebSocketEvent);
    ws.setReconnectInterval(5000);
  } else {
    Serial.println("\nWiFi connection failed!");
    Serial.println("Will continue with diagnostics in offline mode");
  }
  
  Serial.println("Setup complete - starting diagnostic monitoring");
}

void loop() {
  esp_task_wdt_reset();
  
  // Run diagnostics
  runDiagnostics();
  
  // Handle WebSocket if connected
  if (WiFi.status() == WL_CONNECTED) {
    ws.loop();
  }
  
  delay(100);
}

void reportSystemInfo() {
  Serial.println("\n==== SYSTEM INFORMATION ====");
  
  // ESP32 Info
  Serial.printf("ESP32 Chip Model: %s\n", ESP.getChipModel());
  Serial.printf("Chip Revision: %d\n", ESP.getChipRevision());
  Serial.printf("CPU Frequency: %d MHz\n", ESP.getCpuFreqMHz());
  Serial.printf("Flash Size: %d bytes\n", ESP.getFlashChipSize());
  Serial.printf("Flash Speed: %d Hz\n", ESP.getFlashChipSpeed());
  
  // Memory Info
  Serial.printf("Total Heap: %d bytes\n", ESP.getHeapSize());
  Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("Min Free Heap: %d bytes\n", ESP.getMinFreeHeap());
  Serial.printf("Max Alloc Heap: %d bytes\n", ESP.getMaxAllocHeap());
  
  // PSRAM Info (if available)
  if (psramFound()) {
    Serial.printf("PSRAM Found: %d bytes\n", ESP.getPsramSize());
    Serial.printf("Free PSRAM: %d bytes\n", ESP.getFreePsram());
  } else {
    Serial.println("PSRAM: Not found");
  }
  
  Serial.println("==============================\n");
}

void runDiagnostics() {
  unsigned long now = millis();
  
  if (now - lastDiagnosticReport >= DIAGNOSTIC_INTERVAL) {
    lastDiagnosticReport = now;
    
#ifdef ENABLE_MEMORY_DIAGNOSTICS
    reportMemoryStatus();
#endif

#ifdef ENABLE_STACK_MONITORING
    reportStackStatus();
#endif

#ifdef ENABLE_TASK_MONITORING
    reportTaskStatus();
#endif
    
    // Check for memory leaks
    static size_t lastHeapSize = ESP.getFreeHeap();
    size_t currentHeapSize = ESP.getFreeHeap();
    
    if (currentHeapSize < lastHeapSize - 1000) { // More than 1KB lost
      Serial.printf("[WARNING] Potential memory leak detected! Lost %d bytes\n", 
                   lastHeapSize - currentHeapSize);
    }
    lastHeapSize = currentHeapSize;
    
    // Check WiFi stability
    if (WiFi.status() != WL_CONNECTED) {
      Serial.printf("[WARNING] WiFi disconnected! Status: %d\n", WiFi.status());
    } else {
      Serial.printf("[INFO] WiFi stable, RSSI: %d dBm\n", WiFi.RSSI());
    }
    
    Serial.println("--------------------");
  }
}

void reportMemoryStatus() {
  Serial.println("[MEMORY DIAGNOSTIC]");
  Serial.printf("  Free Heap: %d bytes (%.1f%% of total)\n", 
               ESP.getFreeHeap(), 
               (float)ESP.getFreeHeap() / ESP.getHeapSize() * 100);
  Serial.printf("  Min Free Heap: %d bytes\n", ESP.getMinFreeHeap());
  Serial.printf("  Max Alloc: %d bytes\n", ESP.getMaxAllocHeap());
  
  // Critical memory check
  if (ESP.getFreeHeap() < 50000) {
    Serial.println("  [CRITICAL] Low heap memory!");
  } else if (ESP.getFreeHeap() < 100000) {
    Serial.println("  [WARNING] Heap memory getting low");
  }
  
  if (psramFound()) {
    Serial.printf("  Free PSRAM: %d bytes\n", ESP.getFreePsram());
  }
}

void reportStackStatus() {
  UBaseType_t stackHighWaterMark = uxTaskGetStackHighWaterMark(NULL);
  Serial.printf("[STACK] High Water Mark: %d bytes remaining\n", stackHighWaterMark);
  
  if (stackHighWaterMark < 1024) {
    Serial.println("  [CRITICAL] Stack overflow risk!");
  } else if (stackHighWaterMark < 2048) {
    Serial.println("  [WARNING] Stack getting low");
  }
}

void reportTaskStatus() {
  Serial.printf("[TASK] Current task: %s\n", pcTaskGetName(NULL));
  Serial.printf("[TASK] Task count: %d\n", uxTaskGetNumberOfTasks());
}

void onWebSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to: %s\n", payload);
      break;
      
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected!");
      break;
      
    case WStype_TEXT:
      Serial.printf("[WS] Received text: %s\n", payload);
      
#ifdef ENABLE_JSON_SIZE_MONITORING
      // Monitor JSON processing
      Serial.printf("[JSON] Processing %d bytes\n", length);
      
      // Test JSON parsing safely
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, payload, length);
      
      if (error) {
        Serial.printf("[JSON ERROR] Failed to parse: %s\n", error.c_str());
      } else {
        Serial.printf("[JSON] Parsed successfully, memory used: %d bytes\n", doc.memoryUsage());
      }
#endif
      break;
      
    case WStype_ERROR:
      Serial.printf("[WS ERROR] Error: %s\n", payload);
      break;
      
    default:
      Serial.printf("[WS] Unhandled event type: %d\n", type);
      break;
  }
}

// Test functions to simulate potential crash conditions
void testMemoryLeak() {
  Serial.println("Testing memory leak...");
  for (int i = 0; i < 100; i++) {
    char* ptr = (char*)malloc(1000);
    // Intentionally not freeing to test leak detection
    delay(10);
  }
}

void testStackOverflow() {
  Serial.println("Testing stack usage...");
  char bigArray[10000]; // Large stack allocation
  memset(bigArray, 0, sizeof(bigArray));
  Serial.printf("Stack test complete, used %d bytes\n", sizeof(bigArray));
}

void testJSONProcessing() {
  Serial.println("Testing JSON processing...");
  
  // Test with various JSON sizes
  const char* testMessages[] = {
    "{\"type\":\"test\",\"data\":\"small\"}",
    "{\"type\":\"test\",\"data\":\"" "very_long_string_to_test_memory_usage_with_large_json_payloads" "\"}",
    "{\"type\":\"config_update\",\"switches\":[{\"gpio\":13,\"name\":\"test1\"},{\"gpio\":12,\"name\":\"test2\"}]}"
  };
  
  for (int i = 0; i < 3; i++) {
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, testMessages[i]);
    
    if (error) {
      Serial.printf("JSON test %d failed: %s\n", i, error.c_str());
    } else {
      Serial.printf("JSON test %d OK, memory: %d bytes\n", i, doc.memoryUsage());
    }
  }
}
