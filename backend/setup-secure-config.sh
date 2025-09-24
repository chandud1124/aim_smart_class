#!/bin/bash

# Secure Configuration Setup Script for IoT Smart Classroom
# This script helps set up secure configuration management

echo "🔐 IoT Smart Classroom - Secure Configuration Setup"
echo "=================================================="
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    echo "Usage: cd backend && ./setup-secure-config.sh"
    exit 1
fi

echo "📁 Working directory: $(pwd)"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed or not in PATH"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Run the secure configuration setup
echo "🚀 Starting secure configuration setup..."
echo "This will:"
echo "  - Generate encryption keys"
echo "  - Collect sensitive configuration values"
echo "  - Encrypt and store configuration securely"
echo "  - Generate ESP32 secure config header"
echo ""

node scripts/secure-config.js setup

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Secure configuration setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Review the generated ESP32 secure_config.h file"
    echo "  2. Update your ESP32 firmware to include secure_config.h"
    echo "  3. Test the configuration with: node scripts/secure-config.js validate"
    echo "  4. Update your .env file to use secure config values"
    echo ""
    echo "🔒 Security reminders:"
    echo "  - Never commit secure_config.h or config/ directory to version control"
    echo "  - Keep your CONFIG_MASTER_PASSWORD secure"
    echo "  - Regularly rotate encryption keys in production"
    echo ""
else
    echo ""
    echo "❌ Secure configuration setup failed!"
    echo "Please check the error messages above and try again."
    exit 1
fi