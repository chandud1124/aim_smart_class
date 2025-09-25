const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class SecureConfigManager {
    constructor() {
        this.configDir = path.join(__dirname, '..', 'config');
        this.encryptedConfigPath = path.join(this.configDir, 'encrypted.env');
        this.keyPath = path.join(this.configDir, 'config.key');
        this.algorithm = 'aes-256-gcm';
    }

    /**
     * Generate a secure encryption key
     */
    generateKey() {
        return crypto.randomBytes(32);
    }

    /**
     * Encrypt configuration data
     */
    encryptConfig(configData, key) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);

        let encrypted = cipher.update(JSON.stringify(configData), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt configuration data
     */
    decryptConfig(encryptedData, key, iv, authTag) {
        const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));

        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }

    /**
     * Save encryption key securely
     */
    saveKey(key) {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }

        // In production, this key should be stored in a secure key management service
        // For development, we'll store it encrypted with a master password
        const masterPassword = process.env.CONFIG_MASTER_PASSWORD || 'default-dev-password-change-in-production';

        const keyIv = crypto.randomBytes(16);
        const keyCipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(masterPassword, 'salt', 32), keyIv);
        let encryptedKey = keyCipher.update(key.toString('hex'), 'utf8', 'hex');
        encryptedKey += keyCipher.final('hex');

        // Store both encrypted key and IV
        const keyData = {
            encrypted: encryptedKey,
            iv: keyIv.toString('hex')
        };
        fs.writeFileSync(this.keyPath, JSON.stringify(keyData, null, 2), 'utf8');
        console.log('✅ Encryption key saved securely');
    }

    /**
     * Load encryption key
     */
    loadKey() {
        if (!fs.existsSync(this.keyPath)) {
            throw new Error('Encryption key not found. Run setup first.');
        }

        const masterPassword = process.env.CONFIG_MASTER_PASSWORD || 'default-dev-password-change-in-production';

        const keyData = JSON.parse(fs.readFileSync(this.keyPath, 'utf8'));
        const keyDecipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(masterPassword, 'salt', 32), Buffer.from(keyData.iv, 'hex'));
        let decryptedKey = keyDecipher.update(keyData.encrypted, 'hex', 'utf8');
        decryptedKey += keyDecipher.final('utf8');

        return Buffer.from(decryptedKey, 'hex');
    }

    /**
     * Setup secure configuration
     */
    async setupSecureConfig() {
        console.log('🔐 Setting up Secure Configuration Management');
        console.log('==========================================');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise(resolve => rl.question(query, resolve));

        try {
            // Generate encryption key
            const key = this.generateKey();
            this.saveKey(key);

            // Collect sensitive configuration
            const config = {};

            console.log('\n📝 Enter sensitive configuration values:');

            config.JWT_SECRET = await question('JWT Secret (press Enter for auto-generated): ');
            if (!config.JWT_SECRET) {
                config.JWT_SECRET = crypto.randomBytes(32).toString('hex');
                console.log(`Auto-generated JWT Secret: ${config.JWT_SECRET}`);
            }

            config.MONGODB_URI = await question('MongoDB URI: ') || 'mongodb://localhost:27017/iot_classroom';
            config.EMAIL_USERNAME = await question('Email Username: ') || '';
            config.EMAIL_PASSWORD = await question('Email Password: ') || '';

            // ESP32 Configuration
            console.log('\n🤖 ESP32 Device Configuration:');
            config.ESP32_SECRET_KEY = await question('ESP32 Device Secret Key (press Enter for auto-generated): ');
            if (!config.ESP32_SECRET_KEY) {
                config.ESP32_SECRET_KEY = crypto.randomBytes(32).toString('hex');
                console.log(`Auto-generated ESP32 Secret: ${config.ESP32_SECRET_KEY}`);
            }

            config.WIFI_SSID = await question('WiFi SSID: ') || 'AIMS-WIFI';
            config.WIFI_PASSWORD = await question('WiFi Password: ') || '';
            config.WEBSOCKET_HOST = await question('WebSocket Host: ') || '172.16.3.171';
            config.WEBSOCKET_PORT = await question('WebSocket Port: ') || '3001';

            // Encrypt and save configuration
            const encryptedData = this.encryptConfig(config, key);

            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            fs.writeFileSync(this.encryptedConfigPath, JSON.stringify(encryptedData, null, 2), 'utf8');

            console.log('\n✅ Secure configuration setup complete!');
            console.log(`📁 Configuration saved to: ${this.encryptedConfigPath}`);
            console.log(`🔑 Encryption key saved to: ${this.keyPath}`);

            // Generate ESP32 config header
            this.generateESP32Config(config);

        } catch (error) {
            console.error('❌ Error setting up secure configuration:', error.message);
        } finally {
            rl.close();
        }
    }

    /**
     * Load secure configuration
     */
    loadSecureConfig() {
        try {
            const key = this.loadKey();
            const encryptedData = JSON.parse(fs.readFileSync(this.encryptedConfigPath, 'utf8'));

            const config = this.decryptConfig(
                encryptedData.encrypted,
                key,
                encryptedData.iv,
                encryptedData.authTag
            );

            return config;
        } catch (error) {
            console.error('❌ Error loading secure configuration:', error.message);
            throw error;
        }
    }

    /**
     * Generate ESP32 configuration header file
     */
    generateESP32Config(config) {
        const esp32ConfigPath = path.join(__dirname, '..', '..', 'esp32', 'secure_config.h');

        const headerContent = `#ifndef SECURE_CONFIG_H
#define SECURE_CONFIG_H

// 🔐 SECURE CONFIGURATION - DO NOT COMMIT TO VERSION CONTROL
// This file is auto-generated by secure configuration setup
// Contains encrypted credentials for ESP32 device

// ---------------- WiFi Configuration ----------------
#define WIFI_SSID "${config.WIFI_SSID}"
#define WIFI_PASSWORD "${config.WIFI_PASSWORD || ''}"

// ---------------- WebSocket Configuration ----------------
#define WEBSOCKET_HOST "${config.WEBSOCKET_HOST}"
#define WEBSOCKET_PORT ${config.WEBSOCKET_PORT}
#define WEBSOCKET_PATH "/esp32-ws"

// ---------------- Device Authentication ----------------
#define DEVICE_SECRET_KEY "${config.ESP32_SECRET_KEY}"

// ---------------- Security Settings ----------------
#define USE_SECURE_WS 1
#define ENCRYPTED_CONFIG 1

#endif // SECURE_CONFIG_H
`;

        fs.writeFileSync(esp32ConfigPath, headerContent, 'utf8');
        console.log(`✅ ESP32 secure config generated: ${esp32ConfigPath}`);
        console.log('⚠️  IMPORTANT: Add secure_config.h to .gitignore to prevent credential exposure!');
    }

    /**
     * Update configuration value
     */
    async updateConfigValue(key, value) {
        try {
            const currentConfig = this.loadSecureConfig();
            currentConfig[key] = value;

            const encryptionKey = this.loadKey();
            const encryptedData = this.encryptConfig(currentConfig, encryptionKey);

            fs.writeFileSync(this.encryptedConfigPath, JSON.stringify(encryptedData, null, 2), 'utf8');

            console.log(`✅ Configuration value '${key}' updated securely`);

            // Regenerate ESP32 config if relevant
            if (['WIFI_SSID', 'WIFI_PASSWORD', 'WEBSOCKET_HOST', 'WEBSOCKET_PORT', 'ESP32_SECRET_KEY'].includes(key)) {
                this.generateESP32Config(currentConfig);
            }

        } catch (error) {
            console.error('❌ Error updating configuration:', error.message);
        }
    }

    /**
     * Get configuration value
     */
    getConfigValue(key) {
        const config = this.loadSecureConfig();
        return config[key];
    }

    /**
     * List all configuration keys (without values for security)
     */
    listConfigKeys() {
        const config = this.loadSecureConfig();
        console.log('🔑 Available configuration keys:');
        Object.keys(config).forEach(key => {
            console.log(`  - ${key}`);
        });
    }

    /**
     * Validate configuration integrity
     */
    validateConfig() {
        try {
            const config = this.loadSecureConfig();
            const requiredKeys = ['JWT_SECRET', 'MONGODB_URI', 'ESP32_SECRET_KEY'];

            console.log('🔍 Validating configuration integrity...');

            let valid = true;
            requiredKeys.forEach(key => {
                if (!config[key]) {
                    console.log(`❌ Missing required key: ${key}`);
                    valid = false;
                } else {
                    console.log(`✅ ${key}: Present`);
                }
            });

            if (valid) {
                console.log('✅ Configuration validation passed');
            } else {
                console.log('❌ Configuration validation failed');
            }

            return valid;
        } catch (error) {
            console.log('❌ Configuration validation error:', error.message);
            return false;
        }
    }
}

// CLI Interface
async function main() {
    const manager = new SecureConfigManager();
    const command = process.argv[2];

    switch (command) {
        case 'setup':
            await manager.setupSecureConfig();
            break;
        case 'load':
            const config = manager.loadSecureConfig();
            console.log('Current configuration:');
            Object.keys(config).forEach(key => {
                console.log(`  ${key}: ${key.includes('SECRET') || key.includes('PASSWORD') ? '***HIDDEN***' : config[key]}`);
            });
            break;
        case 'update':
            const key = process.argv[3];
            const value = process.argv[4];
            if (!key || !value) {
                console.log('Usage: node secure-config.js update <key> <value>');
                process.exit(1);
            }
            await manager.updateConfigValue(key, value);
            break;
        case 'get':
            const getKey = process.argv[3];
            if (!getKey) {
                console.log('Usage: node secure-config.js get <key>');
                process.exit(1);
            }
            console.log(manager.getConfigValue(getKey));
            break;
        case 'list':
            manager.listConfigKeys();
            break;
        case 'validate':
            manager.validateConfig();
            break;
        default:
            console.log('Secure Configuration Manager');
            console.log('Usage: node secure-config.js <command>');
            console.log('');
            console.log('Commands:');
            console.log('  setup     - Initial secure configuration setup');
            console.log('  load      - Load and display current configuration');
            console.log('  update    - Update a configuration value');
            console.log('  get       - Get a specific configuration value');
            console.log('  list      - List all configuration keys');
            console.log('  validate  - Validate configuration integrity');
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SecureConfigManager;