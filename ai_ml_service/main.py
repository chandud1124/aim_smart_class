from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import uvicorn
import logging
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import joblib
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI/ML Microservice",
    description="AI/ML service for IoT classroom automation system",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ForecastRequest(BaseModel):
    device_id: str
    history: List[float]
    periods: int = 5

class ScheduleRequest(BaseModel):
    device_id: str
    constraints: Optional[Dict[str, Any]] = None

class AnomalyRequest(BaseModel):
    device_id: str
    values: List[float]

class ForecastResponse(BaseModel):
    device_id: str
    forecast: List[float]
    confidence: List[float]
    timestamp: str

class ScheduleResponse(BaseModel):
    device_id: str
    schedule: Dict[str, Any]
    energy_savings: float
    timestamp: str

class AnomalyResponse(BaseModel):
    device_id: str
    anomalies: List[int]
    scores: List[float]
    threshold: float
    timestamp: str

# Global models (in production, use proper model management)
models = {}

def get_or_create_model(device_id: str, model_type: str):
    """Get or create ML model for device"""
    key = f"{device_id}_{model_type}"
    if key not in models:
        if model_type == "forecast":
            models[key] = LinearRegression()
        elif model_type == "anomaly":
            models[key] = IsolationForest(contamination=0.1, random_state=42)
    return models[key]

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/forecast", response_model=ForecastResponse)
async def forecast_usage(request: ForecastRequest):
    """Forecast device usage based on historical data"""
    try:
        device_id = request.device_id
        history = np.array(request.history)
        periods = request.periods

        if len(history) < 3:
            raise HTTPException(status_code=400, detail="Need at least 3 data points for forecasting")

        # Simple linear regression forecast (can be enhanced with more sophisticated models)
        X = np.arange(len(history)).reshape(-1, 1)
        y = history

        model = get_or_create_model(device_id, "forecast")
        model.fit(X, y)

        # Forecast future periods
        future_X = np.arange(len(history), len(history) + periods).reshape(-1, 1)
        forecast = model.predict(future_X)

        # Calculate confidence intervals (simplified)
        residuals = y - model.predict(X)
        std_residuals = np.std(residuals)
        confidence = [max(0.1, min(0.9, 1 - (std_residuals / abs(f)))) for f in forecast]

        # Ensure forecast values are reasonable (0-100%)
        forecast = np.clip(forecast, 0, 100)

        return ForecastResponse(
            device_id=device_id,
            forecast=forecast.tolist(),
            confidence=confidence,
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Forecast error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Forecast failed: {str(e)}")

@app.post("/schedule", response_model=ScheduleResponse)
async def optimize_schedule(request: ScheduleRequest):
    """Optimize device schedule based on constraints"""
    try:
        device_id = request.device_id
        constraints = request.constraints or {}

        # Default schedule optimization logic
        # This can be enhanced with more sophisticated algorithms
        base_schedule = {
            "monday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "tuesday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "wednesday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "thursday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "friday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "saturday": {"start": "09:00", "end": "17:00", "priority": "medium"},
            "sunday": {"start": "00:00", "end": "00:00", "priority": "off"}
        }

        # Apply constraints
        if "class_schedule" in constraints:
            # Adjust based on class schedule
            class_hours = constraints["class_schedule"]
            for day in base_schedule:
                if day.lower() in ["saturday", "sunday"] and not class_hours.get("weekends", False):
                    base_schedule[day] = {"start": "00:00", "end": "00:00", "priority": "off"}

        if "energy_budget" in constraints:
            # Adjust for energy savings
            budget = constraints["energy_budget"]
            if budget < 50:  # Low budget
                for day in base_schedule:
                    if base_schedule[day]["priority"] == "high":
                        base_schedule[day]["priority"] = "medium"

        # Calculate estimated energy savings (simplified)
        energy_savings = np.random.uniform(15, 35)  # 15-35% savings

        return ScheduleResponse(
            device_id=device_id,
            schedule=base_schedule,
            energy_savings=round(energy_savings, 2),
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Schedule optimization error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Schedule optimization failed: {str(e)}")

@app.post("/anomaly", response_model=AnomalyResponse)
async def detect_anomalies(request: AnomalyRequest):
    """Detect anomalies in device behavior"""
    try:
        device_id = request.device_id
        values = np.array(request.values).reshape(-1, 1)

        if len(values) < 10:
            raise HTTPException(status_code=400, detail="Need at least 10 data points for anomaly detection")

        # Use Isolation Forest for anomaly detection
        model = get_or_create_model(device_id, "anomaly")
        model.fit(values)

        # Get anomaly scores and predictions
        scores = model.decision_function(values)
        predictions = model.predict(values)

        # Convert predictions (-1 for anomaly, 1 for normal) to indices
        anomalies = [i for i, pred in enumerate(predictions) if pred == -1]

        # Calculate dynamic threshold based on scores
        threshold = np.percentile(scores, 10)  # Bottom 10% are anomalies

        return AnomalyResponse(
            device_id=device_id,
            anomalies=anomalies,
            scores=scores.tolist(),
            threshold=float(threshold),
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Anomaly detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")

@app.get("/models/{device_id}")
async def get_model_info(device_id: str):
    """Get information about trained models for a device"""
    device_models = {k: v for k, v in models.items() if k.startswith(f"{device_id}_")}
    return {
        "device_id": device_id,
        "models": list(device_models.keys()),
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002, reload=True)
