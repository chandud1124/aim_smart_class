@echo off
REM Secure Configuration Setup Script for IoT Smart Classroom (Windows)
REM This script helps set up secure configuration management

echo 🔐 IoT Smart Classroom - Secure Configuration Setup
echo ==================================================
echo.

REM Check if we're in the backend directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the backend directory
    echo Usage: cd backend ^&^& setup-secure-config.bat
    goto :error
)

echo 📁 Working directory: %CD%
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Node.js is not installed or not in PATH
    goto :error
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%
echo.

REM Run the secure configuration setup
echo 🚀 Starting secure configuration setup...
echo This will:
echo   - Generate encryption keys
echo   - Collect sensitive configuration values
echo   - Encrypt and store configuration securely
echo   - Generate ESP32 secure config header
echo.

node scripts/secure-config.js setup

if %errorlevel% equ 0 (
    echo.
    echo ✅ Secure configuration setup completed successfully!
    echo.
    echo 📋 Next steps:
    echo   1. Review the generated ESP32 secure_config.h file
    echo   2. Update your ESP32 firmware to include secure_config.h
    echo   3. Test the configuration with: node scripts/secure-config.js validate
    echo   4. Update your .env file to use secure config values
    echo.
    echo 🔒 Security reminders:
    echo   - Never commit secure_config.h or config/ directory to version control
    echo   - Keep your CONFIG_MASTER_PASSWORD secure
    echo   - Regularly rotate encryption keys in production
    echo.
) else (
    echo.
    echo ❌ Secure configuration setup failed!
    echo Please check the error messages above and try again.
    goto :error
)

goto :end

:error
exit /b 1

:end