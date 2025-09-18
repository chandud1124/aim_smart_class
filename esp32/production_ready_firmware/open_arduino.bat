@echo off
echo ========================================
echo ESP32 Production Firmware - Arduino IDE
echo ========================================
echo.
echo Opening Arduino IDE project...
echo.
echo If Arduino IDE doesn't open automatically,
echo manually open: production_ready_firmware.ino
echo.
echo Make sure you have installed:
echo - WebSockets library by Markus Sattler
echo - ArduinoJson library by Benoit Blanchon
echo - ESP32 board support in Arduino IDE
echo.

REM Try to open with Arduino IDE if installed
start "" "production_ready_firmware.ino"

echo.
echo Project files ready for upload to ESP32!
echo ========================================