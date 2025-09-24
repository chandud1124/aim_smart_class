from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import pandas as pd

app = FastAPI(title="Smart Classroom AI/ML Service")

class ForecastRequest(BaseModel):
    device_id: str
    history: List[float]
    periods: int = 5

class ForecastResponse(BaseModel):
    forecast: List[float]

class ScheduleRequest(BaseModel):
    device_id: str
    constraints: Optional[dict] = None

class ScheduleResponse(BaseModel):
    schedule: List[str]

class AnomalyRequest(BaseModel):
    device_id: str
    values: List[float]

class AnomalyResponse(BaseModel):
    anomalies: List[int]

@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest):
    # Simple moving average forecast
    if len(req.history) < 2:
        raise HTTPException(status_code=400, detail="Not enough history data.")
    series = pd.Series(req.history)
    forecast = series.rolling(window=2).mean().iloc[-1]
    result = [forecast] * req.periods
    return ForecastResponse(forecast=result)

@app.post("/schedule", response_model=ScheduleResponse)
def schedule(req: ScheduleRequest):
    # Dummy schedule logic
    schedule = ["08:00", "12:00", "16:00"]
    return ScheduleResponse(schedule=schedule)

@app.post("/anomaly", response_model=AnomalyResponse)
def anomaly(req: AnomalyRequest):
    # Simple z-score anomaly detection
    values = np.array(req.values)
    if len(values) < 2:
        return AnomalyResponse(anomalies=[])
    z_scores = np.abs((values - values.mean()) / values.std())
    anomalies = np.where(z_scores > 2)[0].tolist()
    return AnomalyResponse(anomalies=anomalies)
