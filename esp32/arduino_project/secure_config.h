// -----------------------------------------------------------------------------
// Secure Configuration Management for ESP32
// Supports multiple configuration methods for production deployment
// -----------------------------------------------------------------------------

#ifndef SECURE_CONFIG_H
#define SECURE_CONFIG_H

#include <Preferences.h>
#include <ArduinoJson.h>
#include <esp_partition.h>
#include <esp_ota_ops.h>

// Configuration storage namespace
#define CONFIG_NAMESPACE "esp32_config"

// Configuration structure
struct DeviceConfig {
    char wifi_ssid[32];
    char wifi_password[64];
    char backend_host[64];
    uint16_t backend_port;
    char device_secret[65];
    char device_name[32];
    bool use_https;
    char ota_password[32];
    uint32_t config_version;
    uint32_t checksum;
};

// Configuration methods
enum ConfigMethod {
    CONFIG_METHOD_NONE = 0,
    CONFIG_METHOD_SERIAL = 1,      // Interactive serial setup
    CONFIG_METHOD_WIFI_AP = 2,     // WiFi AP mode for web config
    CONFIG_METHOD_SD_CARD = 3,     // SD card configuration file
    CONFIG_METHOD_OTA_CONFIG = 4,  // Over-the-air configuration
    CONFIG_METHOD_DEFAULT = 5      // Use compiled defaults (development only)
};

// Configuration manager class
class SecureConfigManager {
private:
    Preferences preferences;
    DeviceConfig config;
    ConfigMethod currentMethod;
    bool configLoaded;

    // Calculate checksum for config validation
    uint32_t calculateChecksum(const DeviceConfig& cfg) {
        uint32_t sum = 0;
        const uint8_t* data = reinterpret_cast<const uint8_t*>(&cfg);
        for (size_t i = 0; i < sizeof(DeviceConfig) - sizeof(uint32_t); ++i) {
            sum = ((sum << 5) + sum) + data[i]; // Simple hash
        }
        return sum;
    }

    // Validate configuration integrity
    bool validateConfig(const DeviceConfig& cfg) {
        return cfg.checksum == calculateChecksum(cfg);
    }

    // Load configuration from NVS
    bool loadFromNVS() {
        if (!preferences.begin(CONFIG_NAMESPACE, true)) {
            Serial.println("[CONFIG] Failed to open NVS namespace");
            return false;
        }

        size_t configSize = preferences.getBytes("config", &config, sizeof(DeviceConfig));
        preferences.end();

        if (configSize != sizeof(DeviceConfig)) {
            Serial.println("[CONFIG] Invalid config size in NVS");
            return false;
        }

        if (!validateConfig(config)) {
            Serial.println("[CONFIG] Config checksum validation failed");
            return false;
        }

        Serial.printf("[CONFIG] Loaded config v%d from NVS\n", config.config_version);
        return true;
    }

    // Save configuration to NVS
    bool saveToNVS() {
        config.checksum = calculateChecksum(config);
        config.config_version++;

        if (!preferences.begin(CONFIG_NAMESPACE, false)) {
            Serial.println("[CONFIG] Failed to open NVS namespace for writing");
            return false;
        }

        size_t written = preferences.putBytes("config", &config, sizeof(DeviceConfig));
        preferences.end();

        if (written != sizeof(DeviceConfig)) {
            Serial.println("[CONFIG] Failed to save complete config to NVS");
            return false;
        }

        Serial.printf("[CONFIG] Saved config v%d to NVS\n", config.config_version);
        return true;
    }

public:
    SecureConfigManager() : currentMethod(CONFIG_METHOD_NONE), configLoaded(false) {
        memset(&config, 0, sizeof(DeviceConfig));
    }

    // Initialize configuration system
    bool begin() {
        Serial.println("[CONFIG] Initializing secure configuration...");

        // Try to load existing configuration
        if (loadFromNVS()) {
            configLoaded = true;
            currentMethod = CONFIG_METHOD_NONE; // Already configured
            Serial.println("[CONFIG] Configuration loaded successfully");
            return true;
        }

        // No valid config found, need to configure
        Serial.println("[CONFIG] No valid configuration found, entering setup mode");
        return enterConfigurationMode();
    }

    // Enter configuration mode
    bool enterConfigurationMode() {
        Serial.println("\n=== ESP32 Configuration Setup ===");
        Serial.println("Available configuration methods:");
        Serial.println("1. Serial Console (Interactive)");
        Serial.println("2. WiFi AP Mode (Web Interface)");
        Serial.println("3. SD Card (config.json)");
        Serial.println("4. Use Development Defaults");
        Serial.print("Select method (1-4): ");

        // Default to serial method if no input within timeout
        unsigned long startTime = millis();
        while (millis() - startTime < 10000) { // 10 second timeout
            if (Serial.available()) {
                int choice = Serial.parseInt();
                switch (choice) {
                    case 1:
                        return configureViaSerial();
                    case 2:
                        return configureViaWiFiAP();
                    case 3:
                        return configureViaSDCard();
                    case 4:
                        return configureViaDefaults();
                    default:
                        Serial.println("Invalid choice. Please select 1-4.");
                        return false;
                }
            }
            delay(100);
        }

        // Timeout - use defaults for development
        Serial.println("\nTimeout - using development defaults");
        return configureViaDefaults();
    }

    // Interactive serial configuration
    bool configureViaSerial() {
        Serial.println("\n=== Serial Configuration ===");

        // WiFi Configuration
        Serial.print("WiFi SSID: ");
        readSerialString(config.wifi_ssid, sizeof(config.wifi_ssid));

        Serial.print("WiFi Password: ");
        readSerialString(config.wifi_password, sizeof(config.wifi_password));

        // Backend Configuration
        Serial.print("Backend Host: ");
        readSerialString(config.backend_host, sizeof(config.backend_host));

        Serial.print("Backend Port (default 3001): ");
        config.backend_port = readSerialInt(3001);

        Serial.print("Use HTTPS (y/n, default n): ");
        config.use_https = readSerialBool(false);

        // Device Configuration
        Serial.print("Device Name: ");
        readSerialString(config.device_name, sizeof(config.device_name));

        Serial.print("Device Secret: ");
        readSerialString(config.device_secret, sizeof(config.device_secret));

        // OTA Configuration
        Serial.print("OTA Password: ");
        readSerialString(config.ota_password, sizeof(config.ota_password));

        currentMethod = CONFIG_METHOD_SERIAL;
        return saveConfiguration();
    }

    // WiFi AP mode configuration (placeholder)
    bool configureViaWiFiAP() {
        Serial.println("\n=== WiFi AP Configuration ===");
        Serial.println("Starting WiFi AP mode...");
        // TODO: Implement WiFi AP web server for configuration
        Serial.println("WiFi AP mode not implemented yet, using defaults");
        return configureViaDefaults();
    }

    // SD card configuration
    bool configureViaSDCard() {
        Serial.println("\n=== SD Card Configuration ===");
        // TODO: Implement SD card JSON file reading
        Serial.println("SD card configuration not implemented yet, using defaults");
        return configureViaDefaults();
    }

    // Development defaults (NOT for production)
    bool configureViaDefaults() {
        Serial.println("\n=== Development Defaults ===");
        Serial.println("⚠️  WARNING: Using development defaults - NOT SECURE FOR PRODUCTION!");

        strcpy(config.wifi_ssid, "AIMS-WIFI");
        strcpy(config.wifi_password, "Aimswifi#2025");
        strcpy(config.backend_host, "172.16.3.171");
        config.backend_port = 3001;
        strcpy(config.device_secret, "eb2930a2e8e3e5cee3743217ea321b1e3929f15ff8e27def");
        strcpy(config.device_name, "ESP32-Device");
        strcpy(config.ota_password, "ota_password");
        config.use_https = false;

        currentMethod = CONFIG_METHOD_DEFAULT;
        return saveConfiguration();
    }

    // Save configuration
    bool saveConfiguration() {
        if (saveToNVS()) {
            configLoaded = true;
            Serial.println("[CONFIG] Configuration saved successfully!");
            printConfiguration();
            return true;
        }
        return false;
    }

    // Get configuration values
    const DeviceConfig& getConfig() const {
        return config;
    }

    // Check if configuration is loaded
    bool isConfigured() const {
        return configLoaded;
    }

    // Print current configuration (without sensitive data)
    void printConfiguration() {
        Serial.println("\n=== Current Configuration ===");
        Serial.printf("WiFi SSID: %s\n", config.wifi_ssid);
        Serial.printf("Backend Host: %s:%d\n", config.backend_host, config.backend_port);
        Serial.printf("HTTPS: %s\n", config.use_https ? "Yes" : "No");
        Serial.printf("Device Name: %s\n", config.device_name);
        Serial.printf("Config Version: %d\n", config.config_version);
        Serial.printf("Config Method: %d\n", currentMethod);
    }

    // Reset configuration
    bool resetConfiguration() {
        if (preferences.begin(CONFIG_NAMESPACE, false)) {
            preferences.clear();
            preferences.end();
            configLoaded = false;
            Serial.println("[CONFIG] Configuration reset");
            return true;
        }
        return false;
    }

private:
    // Helper functions for serial input
    void readSerialString(char* buffer, size_t maxLen) {
        size_t len = 0;
        while (len < maxLen - 1) {
            if (Serial.available()) {
                char c = Serial.read();
                if (c == '\n' || c == '\r') {
                    break;
                }
                buffer[len++] = c;
            }
            delay(10);
        }
        buffer[len] = '\0';
        // Remove trailing whitespace
        while (len > 0 && (buffer[len-1] == ' ' || buffer[len-1] == '\t')) {
            buffer[--len] = '\0';
        }
    }

    int readSerialInt(int defaultValue) {
        unsigned long startTime = millis();
        String input = "";
        while (millis() - startTime < 5000) { // 5 second timeout
            if (Serial.available()) {
                char c = Serial.read();
                if (c == '\n' || c == '\r') {
                    break;
                }
                if (c >= '0' && c <= '9') {
                    input += c;
                }
            }
            delay(10);
        }
        return input.length() > 0 ? input.toInt() : defaultValue;
    }

    bool readSerialBool(bool defaultValue) {
        unsigned long startTime = millis();
        while (millis() - startTime < 5000) { // 5 second timeout
            if (Serial.available()) {
                char c = Serial.read();
                if (c == 'y' || c == 'Y') return true;
                if (c == 'n' || c == 'N') return false;
                if (c == '\n' || c == '\r') break;
            }
            delay(10);
        }
        return defaultValue;
    }
};

// Global configuration instance
extern SecureConfigManager secureConfig;

#endif // SECURE_CONFIG_H