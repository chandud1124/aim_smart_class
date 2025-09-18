@echo off
echo ========================================
echo ESP32 Upload Files Preparation
echo ========================================
echo.
echo Creating upload folder with only essential files...
echo.

REM Create upload folder
mkdir esp32_upload 2>nul

REM Copy only the essential files for ESP32 upload
copy production_ready_firmware.ino esp32_upload\
copy config.h esp32_upload\
copy secure_config.h esp32_upload\
copy secure_config.cpp esp32_upload\
copy ws_manager.h esp32_upload\
copy safe_string.h esp32_upload\
copy rate_limiter.h esp32_upload\
copy log.h esp32_upload\
copy memutils.h esp32_upload\
copy memutils.cpp esp32_upload\

echo.
echo ========================================
echo Essential files copied to: esp32_upload\
echo ========================================
echo.
echo Files ready for ESP32 upload:
echo - production_ready_firmware.ino (main)
echo - config.h
echo - secure_config.h
echo - secure_config.cpp
echo - ws_manager.h
echo - safe_string.h
echo - rate_limiter.h
echo - log.h
echo - memutils.h
echo - memutils.cpp
echo.
echo Total: 10 files
echo.
echo Next steps:
echo 1. Open Arduino IDE
echo 2. File -^> Open -^> esp32_upload\production_ready_firmware.ino
echo 3. Install required libraries (WebSockets, ArduinoJson)
echo 4. Select ESP32 board and port
echo 5. Click Upload
echo.
echo ========================================