# AI & ML Microservice for Smart Classroom

This microservice provides forecasting, scheduling, and anomaly detection for classroom IoT devices. Built with FastAPI and Python, it integrates with the main backend and monitoring stack.

## Features
- Device usage forecasting using linear regression
- Smart scheduling optimization with energy savings
- Anomaly detection using Isolation Forest
- REST API endpoints for integration
- Comprehensive test suite with 80%+ coverage

## Setup
1. Create a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the service:
   ```bash
   uvicorn main:app --reload
   ```

## Testing
Run the comprehensive test suite:

### Local Development (requires Python 3.11+)
```bash
# Install dependencies
pip install -r requirements.txt

# Run all tests
pytest

# Run with coverage report
pytest --cov=main --cov-report=html

# Run specific test file
pytest test_main.py

# Run tests in verbose mode
pytest -v
```

### Docker Testing (recommended)
```bash
# Linux/Mac
./run_tests.sh

# Windows
run_tests.bat

# Or manually:
docker-compose up --build -d
docker-compose exec ai-ml-service pytest test_main.py -v
docker-compose down
```

## Endpoints
- `GET /health` : Health check endpoint
- `POST /forecast` : Get device usage forecast
  - Request: `{"device_id": "string", "history": [float], "periods": int}`
  - Response: `{"device_id": "string", "forecast": [float], "confidence": [float], "timestamp": "string"}`
- `POST /schedule` : Smart scheduling suggestions
  - Request: `{"device_id": "string", "constraints": {"class_schedule": {...}, "energy_budget": float}}`
  - Response: `{"device_id": "string", "schedule": {...}, "energy_savings": float, "timestamp": "string"}`
- `POST /anomaly` : Anomaly detection results
  - Request: `{"device_id": "string", "values": [float]}`
  - Response: `{"device_id": "string", "anomalies": [int], "scores": [float], "threshold": float, "timestamp": "string"}`
- `GET /models/{device_id}` : Get trained models info for device

## Integration
- Connects to main backend via REST
- Can push metrics to Prometheus (optional)
- Designed for Docker deployment
- Runs on `http://127.0.0.1:8002`

## Architecture
- **Forecasting**: Linear regression with confidence intervals
- **Scheduling**: Rule-based optimization with constraint handling
- **Anomaly Detection**: Isolation Forest algorithm
- **Models**: Persisted per device for continuous learning
