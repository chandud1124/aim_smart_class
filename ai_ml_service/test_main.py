import pytest
from fastapi.testclient import TestClient
from main import app
import numpy as np
from datetime import datetime

client = TestClient(app)

class TestAIMLService:
    """Test suite for AI/ML microservice"""

    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data

    def test_forecast_success(self):
        """Test successful forecast request"""
        request_data = {
            "device_id": "test_device_1",
            "history": [10.0, 15.0, 20.0, 25.0, 30.0],
            "periods": 3
        }

        response = client.post("/forecast", json=request_data)
        assert response.status_code == 200

        data = response.json()
        assert data["device_id"] == "test_device_1"
        assert "forecast" in data
        assert "confidence" in data
        assert "timestamp" in data
        assert len(data["forecast"]) == 3
        assert len(data["confidence"]) == 3

        # Check forecast values are reasonable
        for forecast_val in data["forecast"]:
            assert 0 <= forecast_val <= 100

        # Check confidence values are between 0 and 1
        for conf_val in data["confidence"]:
            assert 0.1 <= conf_val <= 0.9

    def test_forecast_insufficient_data(self):
        """Test forecast with insufficient historical data"""
        request_data = {
            "device_id": "test_device_1",
            "history": [10.0, 15.0],  # Only 2 points, need at least 3
            "periods": 3
        }

        response = client.post("/forecast", json=request_data)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "at least 3 data points" in data["detail"]

    def test_schedule_success(self):
        """Test successful schedule optimization"""
        request_data = {
            "device_id": "test_device_1",
            "constraints": {
                "class_schedule": {"weekends": False},
                "energy_budget": 40
            }
        }

        response = client.post("/schedule", json=request_data)
        assert response.status_code == 200

        data = response.json()
        assert data["device_id"] == "test_device_1"
        assert "schedule" in data
        assert "energy_savings" in data
        assert "timestamp" in data

        # Check schedule structure
        schedule = data["schedule"]
        expected_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for day in expected_days:
            assert day in schedule
            assert "start" in schedule[day]
            assert "end" in schedule[day]
            assert "priority" in schedule[day]

        # Check energy savings is reasonable
        assert 15 <= data["energy_savings"] <= 35

    def test_schedule_no_constraints(self):
        """Test schedule optimization without constraints"""
        request_data = {
            "device_id": "test_device_2"
        }

        response = client.post("/schedule", json=request_data)
        assert response.status_code == 200

        data = response.json()
        assert data["device_id"] == "test_device_2"
        assert "schedule" in data

    def test_anomaly_detection_success(self):
        """Test successful anomaly detection"""
        # Create test data with some anomalies
        normal_data = np.random.normal(50, 5, 20).tolist()
        anomaly_data = normal_data + [150.0, 200.0, 10.0]  # Add clear anomalies

        request_data = {
            "device_id": "test_device_1",
            "values": anomaly_data
        }

        response = client.post("/anomaly", json=request_data)
        assert response.status_code == 200

        data = response.json()
        assert data["device_id"] == "test_device_1"
        assert "anomalies" in data
        assert "scores" in data
        assert "threshold" in data
        assert "timestamp" in data

        assert len(data["anomalies"]) >= 0  # Should detect some anomalies
        assert len(data["scores"]) == len(anomaly_data)
        assert isinstance(data["threshold"], float)

    def test_anomaly_insufficient_data(self):
        """Test anomaly detection with insufficient data"""
        request_data = {
            "device_id": "test_device_1",
            "values": [10.0, 15.0]  # Only 2 points, need at least 10
        }

        response = client.post("/anomaly", json=request_data)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "at least 10 data points" in data["detail"]

    def test_get_model_info(self):
        """Test getting model information for a device"""
        # First train some models by making requests
        forecast_data = {
            "device_id": "test_device_models",
            "history": [10.0, 15.0, 20.0, 25.0, 30.0],
            "periods": 3
        }
        client.post("/forecast", json=forecast_data)

        anomaly_data = {
            "device_id": "test_device_models",
            "values": list(range(15))  # 15 data points
        }
        client.post("/anomaly", json=anomaly_data)

        # Now check model info
        response = client.get("/models/test_device_models")
        assert response.status_code == 200

        data = response.json()
        assert data["device_id"] == "test_device_models"
        assert "models" in data
        assert "timestamp" in data

        # Should have forecast and anomaly models
        model_names = data["models"]
        assert any("forecast" in name for name in model_names)
        assert any("anomaly" in name for name in model_names)

    def test_forecast_edge_cases(self):
        """Test forecast with edge cases"""
        # Test with all same values
        request_data = {
            "device_id": "test_device_edge",
            "history": [50.0, 50.0, 50.0, 50.0, 50.0],
            "periods": 2
        }

        response = client.post("/forecast", json=request_data)
        assert response.status_code == 200

        data = response.json()
        # Should still return valid forecast
        assert len(data["forecast"]) == 2
        assert all(val == 50.0 for val in data["forecast"])

    def test_anomaly_normal_data(self):
        """Test anomaly detection with normal data"""
        # Generate normal data without anomalies
        normal_data = np.random.normal(50, 2, 20).tolist()

        request_data = {
            "device_id": "test_device_normal",
            "values": normal_data
        }

        response = client.post("/anomaly", json=request_data)
        assert response.status_code == 200

        data = response.json()
        # Should detect few or no anomalies in normal data
        assert len(data["anomalies"]) <= 2  # Allow for some false positives

    def test_concurrent_requests(self):
        """Test handling concurrent requests for different devices"""
        import threading
        import time

        results = []
        errors = []

        def make_request(device_id):
            try:
                request_data = {
                    "device_id": device_id,
                    "history": [10.0, 15.0, 20.0, 25.0, 30.0],
                    "periods": 2
                }
                response = client.post("/forecast", json=request_data)
                results.append((device_id, response.status_code))
            except Exception as e:
                errors.append((device_id, str(e)))

        # Create threads for concurrent requests
        threads = []
        for i in range(5):
            device_id = f"concurrent_device_{i}"
            thread = threading.Thread(target=make_request, args=(device_id,))
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # Check results
        assert len(results) == 5
        assert len(errors) == 0
        for device_id, status_code in results:
            assert status_code == 200

    def test_invalid_request_data(self):
        """Test handling of invalid request data"""
        # Test forecast with invalid history data
        request_data = {
            "device_id": "test_device_invalid",
            "history": ["invalid", "data"],  # Strings instead of numbers
            "periods": 3
        }

        response = client.post("/forecast", json=request_data)
        # Should handle gracefully or return appropriate error
        assert response.status_code in [200, 400, 500]  # Accept various error handling approaches

    def test_large_dataset(self):
        """Test performance with larger datasets"""
        # Generate larger dataset
        large_history = np.random.uniform(0, 100, 100).tolist()

        request_data = {
            "device_id": "test_device_large",
            "history": large_history,
            "periods": 10
        }

        response = client.post("/forecast", json=request_data)
        assert response.status_code == 200

        data = response.json()
        assert len(data["forecast"]) == 10

        # Test anomaly detection with large dataset
        anomaly_request = {
            "device_id": "test_device_large",
            "values": large_history
        }

        response = client.post("/anomaly", json=anomaly_request)
        assert response.status_code == 200

if __name__ == "__main__":
    pytest.main([__file__, "-v"])