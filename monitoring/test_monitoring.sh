#!/bin/bash

# IoT Classroom Monitoring Test Script
# Tests the monitoring stack components

set -e

echo "🧪 Testing IoT Classroom Monitoring Stack..."
echo "=" * 50

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test HTTP endpoint
test_endpoint() {
    local url=$1
    local service_name=$2
    local expected_status=${3:-200}

    echo -n "Testing $service_name ($url)... "

    if curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$url" | grep -q "^$expected_status$"; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

# Function to test TCP port
test_port() {
    local host=$1
    local port=$2
    local service_name=$3

    echo -n "Testing $service_name ($host:$port)... "

    if timeout 5 bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

# Test results
PASSED=0
FAILED=0

# Test Prometheus
if test_endpoint "http://localhost:9090/-/healthy" "Prometheus Health" 200; then
    ((PASSED++))
else
    ((FAILED++))
fi

if test_endpoint "http://localhost:9090/api/v1/targets" "Prometheus Targets" 200; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Test Grafana
if test_endpoint "http://localhost:3000/api/health" "Grafana Health" 200; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Test Node Exporter
if test_endpoint "http://localhost:9100/metrics" "Node Exporter" 200; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Test MongoDB Exporter (if MongoDB is running)
if curl -s --max-time 5 http://localhost:9216/metrics > /dev/null 2>&1; then
    if test_endpoint "http://localhost:9216/metrics" "MongoDB Exporter" 200; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
else
    echo -e "MongoDB Exporter: ${YELLOW}⚠️  SKIP (MongoDB not running)${NC}"
fi

# Test Redis Exporter (if Redis is running)
if curl -s --max-time 5 http://localhost:9121/metrics > /dev/null 2>&1; then
    if test_endpoint "http://localhost:9121/metrics" "Redis Exporter" 200; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
else
    echo -e "Redis Exporter: ${YELLOW}⚠️  SKIP (Redis not running)${NC}"
fi

# Test backend metrics endpoint (if backend is running)
if curl -s --max-time 5 http://localhost:3001/metrics > /dev/null 2>&1; then
    if test_endpoint "http://localhost:3001/metrics" "Backend Metrics" 200; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
else
    echo -e "Backend Metrics: ${YELLOW}⚠️  SKIP (Backend not running)${NC}"
fi

# Test AI/ML service health (if running)
if curl -s --max-time 5 http://localhost:8002/health > /dev/null 2>&1; then
    if test_endpoint "http://localhost:8002/health" "AI/ML Health" 200; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
else
    echo -e "AI/ML Health: ${YELLOW}⚠️  SKIP (AI/ML service not running)${NC}"
fi

echo ""
echo "=" * 50
echo "Test Results: $PASSED passed, $FAILED failed"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All monitoring tests passed!${NC}"
    echo ""
    echo "Access your monitoring dashboards:"
    echo "- Grafana: http://localhost:3000 (admin/admin)"
    echo "- Prometheus: http://localhost:9090"
    exit 0
else
    echo -e "${RED}❌ Some monitoring tests failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Ensure Docker containers are running: docker ps"
    echo "2. Check container logs: docker logs <container_name>"
    echo "3. Verify network connectivity between containers"
    exit 1
fi