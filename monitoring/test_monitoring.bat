@echo off
REM IoT Classroom Monitoring Test Script for Windows
REM Tests the monitoring stack components

echo 🧪 Testing IoT Classroom Monitoring Stack...
echo ==================================================

REM Test results
set PASSED=0
set FAILED=0

REM Function to test HTTP endpoint
:test_endpoint
set url=%1
set service_name=%2
set expected_status=%3
if "%expected_status%"=="" set expected_status=200

echo|set /p="Testing %service_name% (%url%)... "

curl -s --max-time 10 -o nul -w "%%{http_code}" "%url%" | findstr /r "^%expected_status%$" >nul
if %errorlevel% equ 0 (
    echo ✅ PASS
    set /a PASSED+=1
) else (
    echo ❌ FAIL
    set /a FAILED+=1
)
goto :eof

REM Test Prometheus
call :test_endpoint "http://localhost:9090/-/healthy" "Prometheus Health" 200
call :test_endpoint "http://localhost:9090/api/v1/targets" "Prometheus Targets" 200

REM Test Grafana
call :test_endpoint "http://localhost:3000/api/health" "Grafana Health" 200

REM Test Node Exporter
call :test_endpoint "http://localhost:9100/metrics" "Node Exporter" 200

REM Test MongoDB Exporter (if MongoDB is running)
curl -s --max-time 5 http://localhost:9216/metrics >nul 2>&1
if %errorlevel% equ 0 (
    call :test_endpoint "http://localhost:9216/metrics" "MongoDB Exporter" 200
) else (
    echo MongoDB Exporter: ⚠️  SKIP (MongoDB not running)
)

REM Test Redis Exporter (if Redis is running)
curl -s --max-time 5 http://localhost:9121/metrics >nul 2>&1
if %errorlevel% equ 0 (
    call :test_endpoint "http://localhost:9121/metrics" "Redis Exporter" 200
) else (
    echo Redis Exporter: ⚠️  SKIP (Redis not running)
)

REM Test backend metrics endpoint (if backend is running)
curl -s --max-time 5 http://localhost:3001/metrics >nul 2>&1
if %errorlevel% equ 0 (
    call :test_endpoint "http://localhost:3001/metrics" "Backend Metrics" 200
) else (
    echo Backend Metrics: ⚠️  SKIP (Backend not running)
)

REM Test AI/ML service health (if running)
curl -s --max-time 5 http://localhost:8002/health >nul 2>&1
if %errorlevel% equ 0 (
    call :test_endpoint "http://localhost:8002/health" "AI/ML Health" 200
) else (
    echo AI/ML Health: ⚠️  SKIP (AI/ML service not running)
)

echo.
echo ==================================================
echo Test Results: %PASSED% passed, %FAILED% failed

if %FAILED% equ 0 (
    echo 🎉 All monitoring tests passed!
    echo.
    echo Access your monitoring dashboards:
    echo - Grafana: http://localhost:3000 (admin/admin)
    echo - Prometheus: http://localhost:9090
    exit /b 0
) else (
    echo ❌ Some monitoring tests failed
    echo.
    echo Troubleshooting:
    echo 1. Ensure Docker containers are running: docker ps
    echo 2. Check container logs: docker logs ^<container_name^>
    echo 3. Verify network connectivity between containers
    exit /b 1
)