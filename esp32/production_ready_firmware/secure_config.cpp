// -----------------------------------------------------------------------------
// Secure Configuration Manager Implementation
// Provides secure configuration management for ESP32 devices
// -----------------------------------------------------------------------------

#include "secure_config.h"
#include <WiFi.h>
#include <WebServer.h>
#include <SD.h>
#include <SPIFFS.h>

// Global configuration instance
SecureConfigManager secureConfig;

// Web server for AP mode configuration
WebServer configServer(80);

// HTML template for configuration web interface
const char CONFIG_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <title>ESP32 Configuration</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="text"], input[type="password"], input[type="number"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .checkbox-group { display: flex; align-items: center; }
        .checkbox-group input { width: auto; margin-right: 10px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; width: 100%; font-size: 16px; }
        button:hover { background: #0056b3; }
        .status { margin-top: 20px; padding: 10px; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ESP32 Device Configuration</h1>
        <form id="configForm">
            <div class="form-group">
                <label for="wifi_ssid">WiFi Network Name (SSID):</label>
                <input type="text" id="wifi_ssid" name="wifi_ssid" required>
            </div>
            
            <div class="form-group">
                <label for="wifi_password">WiFi Password:</label>
                <input type="password" id="wifi_password" name="wifi_password" required>
            </div>
            
            <div class="form-group">
                <label for="backend_host">Backend Server Host/IP:</label>
                <input type="text" id="backend_host" name="backend_host" required>
            </div>
            
            <div class="form-group">
                <label for="backend_port">Backend Server Port:</label>
                <input type="number" id="backend_port" name="backend_port" value="3001" required>
            </div>
            
            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="use_https" name="use_https">
                    <label for="use_https">Use HTTPS (SSL/TLS)</label>
                </div>
            </div>
            
            <div class="form-group">
                <label for="device_name">Device Name:</label>
                <input type="text" id="device_name" name="device_name" value="ESP32-Device" required>
            </div>
            
            <div class="form-group">
                <label for="device_secret">Device Secret Key:</label>
                <input type="password" id="device_secret" name="device_secret" required>
            </div>
            
            <div class="form-group">
                <label for="ota_password">OTA Update Password:</label>
                <input type="password" id="ota_password" name="ota_password" required>
            </div>
            
            <button type="submit">Save Configuration</button>
        </form>
        
        <div id="status" class="status" style="display: none;"></div>
    </div>

    <script>
        document.getElementById('configForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            // Convert checkbox to boolean
            data.use_https = e.target.use_https.checked;
            
            try {
                const response = await fetch('/save-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                const statusDiv = document.getElementById('status');
                
                if (result.success) {
                    statusDiv.className = 'status success';
                    statusDiv.textContent = 'Configuration saved successfully! Device will restart...';
                    statusDiv.style.display = 'block';
                    setTimeout(() => {
                        fetch('/restart');
                    }, 2000);
                } else {
                    statusDiv.className = 'status error';
                    statusDiv.textContent = 'Error: ' + result.message;
                    statusDiv.style.display = 'block';
                }
            } catch (error) {
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'status error';
                statusDiv.textContent = 'Network error: ' + error.message;
                statusDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>
)rawliteral";

// WiFi AP mode configuration implementation
bool SecureConfigManager::configureViaWiFiAP() {
    Serial.println("\n=== WiFi AP Configuration Mode ===");

    // Start WiFi in AP mode
    WiFi.mode(WIFI_AP);
    WiFi.softAP("ESP32-Config", "config123");

    Serial.println("WiFi AP started:");
    Serial.print("SSID: ESP32-Config\n");
    Serial.print("Password: config123\n");
    Serial.print("IP: ");
    Serial.println(WiFi.softAPIP());

    // Setup web server routes
    configServer.on("/", HTTP_GET, []() {
        configServer.send(200, "text/html", CONFIG_HTML);
    });

    configServer.on("/save-config", HTTP_POST, [this]() {
        if (configServer.hasArg("plain")) {
            DynamicJsonDocument doc(1024);
            DeserializationError error = deserializeJson(doc, configServer.arg("plain"));

            if (error) {
                configServer.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid JSON\"}");
                return;
            }

            // Parse configuration from JSON
            strlcpy(config.wifi_ssid, doc["wifi_ssid"] | "", sizeof(config.wifi_ssid));
            strlcpy(config.wifi_password, doc["wifi_password"] | "", sizeof(config.wifi_password));
            strlcpy(config.backend_host, doc["backend_host"] | "", sizeof(config.backend_host));
            config.backend_port = doc["backend_port"] | 3001;
            config.use_https = doc["use_https"] | false;
            strlcpy(config.device_name, doc["device_name"] | "ESP32-Device", sizeof(config.device_name));
            strlcpy(config.device_secret, doc["device_secret"] | "", sizeof(config.device_secret));
            strlcpy(config.ota_password, doc["ota_password"] | "", sizeof(config.ota_password));

            // Validate required fields
            if (strlen(config.wifi_ssid) == 0 || strlen(config.wifi_password) == 0 ||
                strlen(config.backend_host) == 0 || strlen(config.device_secret) == 0) {
                configServer.send(400, "application/json", "{\"success\":false,\"message\":\"Missing required fields\"}");
                return;
            }

            if (saveToNVS()) {
                configServer.send(200, "application/json", "{\"success\":true,\"message\":\"Configuration saved\"}");
                currentMethod = CONFIG_METHOD_WIFI_AP;
                configLoaded = true;
            } else {
                configServer.send(500, "application/json", "{\"success\":false,\"message\":\"Failed to save configuration\"}");
            }
        } else {
            configServer.send(400, "application/json", "{\"success\":false,\"message\":\"No data received\"}");
        }
    });

    configServer.on("/restart", HTTP_GET, []() {
        configServer.send(200, "application/json", "{\"success\":true,\"message\":\"Restarting...\"}");
        delay(1000);
        ESP.restart();
    });

    configServer.begin();
    Serial.println("Web server started. Connect to ESP32-Config WiFi network and visit http://192.168.4.1");

    // Wait for configuration (timeout after 5 minutes)
    unsigned long startTime = millis();
    while (millis() - startTime < 300000) { // 5 minutes
        configServer.handleClient();
        if (configLoaded) {
            break;
        }
        delay(100);
    }

    configServer.stop();
    WiFi.softAPdisconnect(true);

    if (configLoaded) {
        Serial.println("[CONFIG] Configuration completed via WiFi AP");
        return true;
    } else {
        Serial.println("[CONFIG] WiFi AP configuration timeout");
        return false;
    }
}

// SD card configuration implementation
bool SecureConfigManager::configureViaSDCard() {
    Serial.println("\n=== SD Card Configuration ===");

    if (!SD.begin()) {
        Serial.println("[CONFIG] SD card initialization failed");
        return false;
    }

    File configFile = SD.open("/config.json", FILE_READ);
    if (!configFile) {
        Serial.println("[CONFIG] config.json not found on SD card");
        return false;
    }

    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, configFile);
    configFile.close();

    if (error) {
        Serial.printf("[CONFIG] JSON parsing failed: %s\n", error.c_str());
        return false;
    }

    // Parse configuration from JSON
    strlcpy(config.wifi_ssid, doc["wifi_ssid"] | "", sizeof(config.wifi_ssid));
    strlcpy(config.wifi_password, doc["wifi_password"] | "", sizeof(config.wifi_password));
    strlcpy(config.backend_host, doc["backend_host"] | "", sizeof(config.backend_host));
    config.backend_port = doc["backend_port"] | 3001;
    config.use_https = doc["use_https"] | false;
    strlcpy(config.device_name, doc["device_name"] | "ESP32-Device", sizeof(config.device_name));
    strlcpy(config.device_secret, doc["device_secret"] | "", sizeof(config.device_secret));
    strlcpy(config.ota_password, doc["ota_password"] | "", sizeof(config.ota_password));

    // Validate required fields
    if (strlen(config.wifi_ssid) == 0 || strlen(config.wifi_password) == 0 ||
        strlen(config.backend_host) == 0 || strlen(config.device_secret) == 0) {
        Serial.println("[CONFIG] Missing required configuration fields");
        return false;
    }

    currentMethod = CONFIG_METHOD_SD_CARD;
    return saveConfiguration();
}

// OTA configuration update (for remote management)
bool updateConfigurationOTA(const char* jsonConfig) {
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, jsonConfig);

    if (error) {
        Serial.printf("[CONFIG] OTA config JSON parsing failed: %s\n", error.c_str());
        return false;
    }

    // Update configuration
    DeviceConfig newConfig = secureConfig.getConfig();

    if (doc.containsKey("wifi_ssid")) {
        strlcpy(newConfig.wifi_ssid, doc["wifi_ssid"], sizeof(newConfig.wifi_ssid));
    }
    if (doc.containsKey("wifi_password")) {
        strlcpy(newConfig.wifi_password, doc["wifi_password"], sizeof(newConfig.wifi_password));
    }
    if (doc.containsKey("backend_host")) {
        strlcpy(newConfig.backend_host, doc["backend_host"], sizeof(newConfig.backend_host));
    }
    if (doc.containsKey("backend_port")) {
        newConfig.backend_port = doc["backend_port"];
    }
    if (doc.containsKey("use_https")) {
        newConfig.use_https = doc["use_https"];
    }
    if (doc.containsKey("device_name")) {
        strlcpy(newConfig.device_name, doc["device_name"], sizeof(newConfig.device_name));
    }
    if (doc.containsKey("device_secret")) {
        strlcpy(newConfig.device_secret, doc["device_secret"], sizeof(newConfig.device_secret));
    }
    if (doc.containsKey("ota_password")) {
        strlcpy(newConfig.ota_password, doc["ota_password"], sizeof(newConfig.ota_password));
    }

    // Validate required fields
    if (strlen(newConfig.wifi_ssid) == 0 || strlen(newConfig.wifi_password) == 0 ||
        strlen(newConfig.backend_host) == 0 || strlen(newConfig.device_secret) == 0) {
        Serial.println("[CONFIG] OTA config missing required fields");
        return false;
    }

    // Save new configuration
    secureConfig.resetConfiguration(); // Clear old config
    memcpy(&secureConfig.config, &newConfig, sizeof(DeviceConfig));

    if (secureConfig.saveConfiguration()) {
        Serial.println("[CONFIG] Configuration updated via OTA");
        return true;
    }

    return false;
}

// Configuration backup and restore functions
bool backupConfigurationToSD() {
    if (!SD.begin()) {
        Serial.println("[CONFIG] SD card not available for backup");
        return false;
    }

    const DeviceConfig& cfg = secureConfig.getConfig();
    DynamicJsonDocument doc(1024);

    doc["wifi_ssid"] = cfg.wifi_ssid;
    doc["wifi_password"] = cfg.wifi_password;
    doc["backend_host"] = cfg.backend_host;
    doc["backend_port"] = cfg.backend_port;
    doc["use_https"] = cfg.use_https;
    doc["device_name"] = cfg.device_name;
    doc["device_secret"] = cfg.device_secret;
    doc["ota_password"] = cfg.ota_password;
    doc["config_version"] = cfg.config_version;

    File backupFile = SD.open("/config_backup.json", FILE_WRITE);
    if (!backupFile) {
        Serial.println("[CONFIG] Failed to create backup file");
        return false;
    }

    serializeJson(doc, backupFile);
    backupFile.close();

    Serial.println("[CONFIG] Configuration backed up to SD card");
    return true;
}

bool restoreConfigurationFromSD() {
    if (!SD.begin()) {
        Serial.println("[CONFIG] SD card not available for restore");
        return false;
    }

    File backupFile = SD.open("/config_backup.json", FILE_READ);
    if (!backupFile) {
        Serial.println("[CONFIG] Backup file not found");
        return false;
    }

    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, backupFile);
    backupFile.close();

    if (error) {
        Serial.printf("[CONFIG] Backup JSON parsing failed: %s\n", error.c_str());
        return false;
    }

    // Parse configuration from backup
    DeviceConfig backupConfig;
    memset(&backupConfig, 0, sizeof(DeviceConfig));

    strlcpy(backupConfig.wifi_ssid, doc["wifi_ssid"] | "", sizeof(backupConfig.wifi_ssid));
    strlcpy(backupConfig.wifi_password, doc["wifi_password"] | "", sizeof(backupConfig.wifi_password));
    strlcpy(backupConfig.backend_host, doc["backend_host"] | "", sizeof(backupConfig.backend_host));
    backupConfig.backend_port = doc["backend_port"] | 3001;
    backupConfig.use_https = doc["use_https"] | false;
    strlcpy(backupConfig.device_name, doc["device_name"] | "ESP32-Device", sizeof(backupConfig.device_name));
    strlcpy(backupConfig.device_secret, doc["device_secret"] | "", sizeof(backupConfig.device_secret));
    strlcpy(backupConfig.ota_password, doc["ota_password"] | "", sizeof(backupConfig.ota_password));

    // Validate and save
    if (strlen(backupConfig.wifi_ssid) == 0 || strlen(backupConfig.wifi_password) == 0 ||
        strlen(backupConfig.backend_host) == 0 || strlen(backupConfig.device_secret) == 0) {
        Serial.println("[CONFIG] Invalid backup configuration");
        return false;
    }

    secureConfig.resetConfiguration();
    memcpy(&secureConfig.config, &backupConfig, sizeof(DeviceConfig));

    if (secureConfig.saveConfiguration()) {
        Serial.println("[CONFIG] Configuration restored from SD card backup");
        return true;
    }

    return false;
}