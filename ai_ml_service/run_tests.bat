@echo off
REM AI/ML Service Test Runner for Windows
REM This script runs tests for the AI/ML microservice

echo 🚀 Starting AI/ML Service Tests...

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ docker-compose is not installed. Please install docker-compose first.
    exit /b 1
)

REM Build and start the AI/ML service
echo 📦 Building AI/ML service...
docker-compose -f ai_ml_service/docker-compose.yml build

echo ▶️  Starting AI/ML service...
docker-compose -f ai_ml_service/docker-compose.yml up -d

REM Wait for service to be healthy
echo ⏳ Waiting for AI/ML service to be healthy...
set max_attempts=30
set attempt=1

:check_health
if %attempt% gtr %max_attempts% (
    echo ❌ AI/ML service failed to start properly
    docker-compose -f ai_ml_service/docker-compose.yml logs
    docker-compose -f ai_ml_service/docker-compose.yml down
    exit /b 1
)

curl -f http://localhost:8002/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ AI/ML service is healthy!
    goto run_tests
)

echo Attempt %attempt%/%max_attempts%: Service not ready yet...
timeout /t 2 /nobreak >nul
set /a attempt+=1
goto check_health

:run_tests
REM Run the tests
echo 🧪 Running AI/ML service tests...
docker-compose -f ai_ml_service/docker-compose.yml exec -T ai-ml-service pytest test_main.py -v --tb=short

REM Store the test exit code
set test_exit_code=%errorlevel%

REM Clean up
echo 🧹 Cleaning up...
docker-compose -f ai_ml_service/docker-compose.yml down

if %test_exit_code% equ 0 (
    echo ✅ All AI/ML service tests passed!
) else (
    echo ❌ Some AI/ML service tests failed!
    exit /b %test_exit_code%
)