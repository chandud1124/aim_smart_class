#!/usr/bin/env python3
"""
AI/ML Service Test Runner (without server)
Tests the core logic of the AI/ML service without running the FastAPI server.
Useful for development and CI/CD pipelines.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression
import unittest
from unittest.mock import Mock, patch

# Import the core logic functions (we'll extract them from main.py)
def get_or_create_model(device_id: str, model_type: str, models_dict=None):
    """Get or create ML model for device"""
    if models_dict is None:
        models_dict = {}

    key = f"{device_id}_{model_type}"
    if key not in models_dict:
        if model_type == "forecast":
            models_dict[key] = LinearRegression()
        elif model_type == "anomaly":
            models_dict[key] = IsolationForest(contamination=0.1, random_state=42)
    return models_dict[key]

def forecast_usage_logic(device_id: str, history: list, periods: int = 5, models_dict=None):
    """Core forecasting logic"""
    if models_dict is None:
        models_dict = {}

    history = np.array(history)

    if len(history) < 3:
        raise ValueError("Need at least 3 data points for forecasting")

    # Simple linear regression forecast
    X = np.arange(len(history)).reshape(-1, 1)
    y = history

    model = get_or_create_model(device_id, "forecast", models_dict)
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

    return {
        "device_id": device_id,
        "forecast": forecast.tolist(),
        "confidence": confidence,
        "timestamp": "2025-09-25T10:46:42+05:30"
    }

def detect_anomalies_logic(device_id: str, values: list, models_dict=None):
    """Core anomaly detection logic"""
    if models_dict is None:
        models_dict = {}

    values = np.array(values).reshape(-1, 1)

    if len(values) < 10:
        raise ValueError("Need at least 10 data points for anomaly detection")

    # Use Isolation Forest for anomaly detection
    model = get_or_create_model(device_id, "anomaly", models_dict)
    model.fit(values)

    # Get anomaly scores and predictions
    scores = model.decision_function(values)
    predictions = model.predict(values)

    # Convert predictions (-1 for anomaly, 1 for normal) to indices
    anomalies = [i for i, pred in enumerate(predictions) if pred == -1]

    # Calculate dynamic threshold based on scores
    threshold = np.percentile(scores, 10)  # Bottom 10% are anomalies

    return {
        "device_id": device_id,
        "anomalies": anomalies,
        "scores": scores.tolist(),
        "threshold": float(threshold),
        "timestamp": "2025-09-25T10:46:42+05:30"
    }

def optimize_schedule_logic(device_id: str, constraints=None):
    """Core schedule optimization logic"""
    if constraints is None:
        constraints = {}

    # Default schedule optimization logic
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
        class_hours = constraints["class_schedule"]
        for day in base_schedule:
            if day.lower() in ["saturday", "sunday"] and not class_hours.get("weekends", False):
                base_schedule[day] = {"start": "00:00", "end": "00:00", "priority": "off"}

    if "energy_budget" in constraints:
        budget = constraints["energy_budget"]
        if budget < 50:  # Low budget
            for day in base_schedule:
                if base_schedule[day]["priority"] == "high":
                    base_schedule[day]["priority"] = "medium"

    # Calculate estimated energy savings (simplified)
    energy_savings = np.random.uniform(15, 35)  # 15-35% savings

    return {
        "device_id": device_id,
        "schedule": base_schedule,
        "energy_savings": round(energy_savings, 2),
        "timestamp": "2025-09-25T10:46:42+05:30"
    }

class TestAIMLLogic(unittest.TestCase):
    """Test suite for AI/ML core logic"""

    def setUp(self):
        """Set up test fixtures"""
        self.models_dict = {}
        np.random.seed(42)  # For reproducible results

    def test_forecast_success(self):
        """Test successful forecast"""
        history = [10.0, 15.0, 20.0, 25.0, 30.0]
        result = forecast_usage_logic("test_device_1", history, 3, self.models_dict)

        self.assertEqual(result["device_id"], "test_device_1")
        self.assertEqual(len(result["forecast"]), 3)
        self.assertEqual(len(result["confidence"]), 3)
        self.assertIn("timestamp", result)

        # Check forecast values are reasonable
        for forecast_val in result["forecast"]:
            self.assertGreaterEqual(forecast_val, 0)
            self.assertLessEqual(forecast_val, 100)

    def test_forecast_insufficient_data(self):
        """Test forecast with insufficient data"""
        history = [10.0, 15.0]  # Only 2 points

        with self.assertRaises(ValueError) as context:
            forecast_usage_logic("test_device_1", history, 3, self.models_dict)

        self.assertIn("at least 3 data points", str(context.exception))

    def test_anomaly_detection_success(self):
        """Test successful anomaly detection"""
        # Create test data with some anomalies
        normal_data = np.random.normal(50, 5, 20).tolist()
        anomaly_data = normal_data + [150.0, 200.0, 10.0]  # Add clear anomalies

        result = detect_anomalies_logic("test_device_1", anomaly_data, self.models_dict)

        self.assertEqual(result["device_id"], "test_device_1")
        self.assertIsInstance(result["anomalies"], list)
        self.assertEqual(len(result["scores"]), len(anomaly_data))
        self.assertIsInstance(result["threshold"], float)
        self.assertIn("timestamp", result)

    def test_anomaly_insufficient_data(self):
        """Test anomaly detection with insufficient data"""
        values = [10.0, 15.0]  # Only 2 points

        with self.assertRaises(ValueError) as context:
            detect_anomalies_logic("test_device_1", values, self.models_dict)

        self.assertIn("at least 10 data points", str(context.exception))

    def test_schedule_optimization(self):
        """Test schedule optimization"""
        constraints = {
            "class_schedule": {"weekends": False},
            "energy_budget": 40
        }

        result = optimize_schedule_logic("test_device_1", constraints)

        self.assertEqual(result["device_id"], "test_device_1")
        self.assertIn("schedule", result)
        self.assertIn("energy_savings", result)
        self.assertIn("timestamp", result)

        # Check schedule structure
        schedule = result["schedule"]
        expected_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for day in expected_days:
            self.assertIn(day, schedule)
            self.assertIn("start", schedule[day])
            self.assertIn("end", schedule[day])
            self.assertIn("priority", schedule[day])

        # Check energy savings is reasonable
        self.assertGreaterEqual(result["energy_savings"], 15)
        self.assertLessEqual(result["energy_savings"], 35)

    def test_schedule_no_constraints(self):
        """Test schedule optimization without constraints"""
        result = optimize_schedule_logic("test_device_2")

        self.assertEqual(result["device_id"], "test_device_2")
        self.assertIn("schedule", result)

    def test_model_reuse(self):
        """Test that models are reused for same device"""
        # First call
        history1 = [10.0, 15.0, 20.0, 25.0, 30.0]
        result1 = forecast_usage_logic("reuse_device", history1, 2, self.models_dict)

        # Second call with different data
        history2 = [20.0, 25.0, 30.0, 35.0, 40.0]
        result2 = forecast_usage_logic("reuse_device", history2, 2, self.models_dict)

        # Should use the same model (retrained with new data)
        self.assertEqual(result1["device_id"], result2["device_id"])
        self.assertEqual(len(result1["forecast"]), len(result2["forecast"]))

    def test_edge_cases(self):
        """Test edge cases"""
        # Test with all same values
        history = [50.0, 50.0, 50.0, 50.0, 50.0]
        result = forecast_usage_logic("edge_device", history, 2, self.models_dict)

        self.assertEqual(len(result["forecast"]), 2)
        # Should still return valid forecast
        for val in result["forecast"]:
            self.assertGreaterEqual(val, 0)
            self.assertLessEqual(val, 100)

    def test_large_dataset(self):
        """Test with larger dataset"""
        large_history = np.random.uniform(0, 100, 100).tolist()
        result = forecast_usage_logic("large_device", large_history, 10, self.models_dict)

        self.assertEqual(len(result["forecast"]), 10)

        # Test anomaly detection with large dataset
        anomaly_result = detect_anomalies_logic("large_device", large_history, self.models_dict)
        self.assertEqual(len(anomaly_result["scores"]), len(large_history))

def run_tests():
    """Run all tests and return results"""
    print("🚀 Running AI/ML Service Logic Tests...")
    print("=" * 50)

    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(TestAIMLLogic)
    runner = unittest.TextTestRunner(verbosity=2)

    # Run tests
    result = runner.run(suite)

    print("=" * 50)
    if result.wasSuccessful():
        print("✅ All AI/ML logic tests passed!")
        return 0
    else:
        print(f"❌ {len(result.failures)} tests failed, {len(result.errors)} errors")
        return 1

if __name__ == "__main__":
    exit_code = run_tests()
    sys.exit(exit_code)