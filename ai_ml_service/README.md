# AI & ML Microservice for Smart Classroom

This microservice provides forecasting, scheduling, and anomaly detection for classroom IoT devices. Built with FastAPI and Python, it integrates with the main backend and monitoring stack.

## Features
- Device usage forecasting
- Smart scheduling
- Anomaly detection (power, device status)
- REST API endpoints for integration

## Setup
1. Create a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the service:
   ```bash
   uvicorn main:app --reload
   ```

## Endpoints
- `/forecast` : Get device usage forecast
- `/schedule` : Smart scheduling suggestions
- `/anomaly` : Anomaly detection results

## Integration
- Connects to main backend via REST
- Can push metrics to Prometheus (optional)
- Designed for Docker deployment
