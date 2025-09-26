#!/bin/bash

# AI/ML Service Test Runner
# This script runs tests for the AI/ML microservice

set -e

echo "🚀 Starting AI/ML Service Tests..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Build and start the AI/ML service
echo "📦 Building AI/ML service..."
docker-compose -f ai_ml_service/docker-compose.yml build

echo "▶️  Starting AI/ML service..."
docker-compose -f ai_ml_service/docker-compose.yml up -d

# Wait for service to be healthy
echo "⏳ Waiting for AI/ML service to be healthy..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost:8002/health &>/dev/null; then
        echo "✅ AI/ML service is healthy!"
        break
    fi

    echo "Attempt $attempt/$max_attempts: Service not ready yet..."
    sleep 2
    ((attempt++))
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ AI/ML service failed to start properly"
    docker-compose -f ai_ml_service/docker-compose.yml logs
    docker-compose -f ai_ml_service/docker-compose.yml down
    exit 1
fi

# Run the tests
echo "🧪 Running AI/ML service tests..."
docker-compose -f ai_ml_service/docker-compose.yml exec -T ai-ml-service pytest test_main.py -v --tb=short

# Store the test exit code
test_exit_code=$?

# Clean up
echo "🧹 Cleaning up..."
docker-compose -f ai_ml_service/docker-compose.yml down

if [ $test_exit_code -eq 0 ]; then
    echo "✅ All AI/ML service tests passed!"
else
    echo "❌ Some AI/ML service tests failed!"
    exit $test_exit_code
fi