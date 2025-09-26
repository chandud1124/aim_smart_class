// routes/aiml.js
// AI/ML service proxy routes

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { handleValidationErrors } = require('../middleware/validationHandler');
const { body } = require('express-validator');

// AI/ML service URL from environment or default
const AI_ML_SERVICE_URL = process.env.AI_ML_SERVICE_URL || 'http://ai-ml-service:8002';

// Proxy forecast requests to AI/ML service
router.post('/forecast',
  body('device_id').isString().notEmpty().withMessage('Device ID is required'),
  body('history').isArray().withMessage('History must be an array'),
  body('periods').isInt({ min: 1, max: 30 }).withMessage('Periods must be between 1 and 30'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const response = await axios.post(`${AI_ML_SERVICE_URL}/forecast`, req.body, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      res.json(response.data);
    } catch (error) {
      console.error('AI/ML forecast error:', error.message);

      // If AI/ML service is unavailable, return mock data
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('AI/ML service unavailable, returning mock forecast data');

        const { device_id, periods = 5 } = req.body;
        const mockForecast = Array.from({ length: periods }, () => Math.floor(Math.random() * 40) + 60);
        const mockConfidence = Array.from({ length: periods }, () => Math.random() * 0.3 + 0.7);

        return res.json({
          device_id,
          forecast: mockForecast,
          confidence: mockConfidence,
          timestamp: new Date().toISOString(),
          source: 'mock',
          note: 'AI/ML service unavailable'
        });
      }

      res.status(error.response?.status || 500).json({
        error: 'AI/ML service error',
        message: error.response?.data?.message || error.message
      });
    }
  }
);

// Proxy schedule optimization requests
router.post('/schedule',
  body('device_id').isString().notEmpty().withMessage('Device ID is required'),
  body('constraints').optional().isObject().withMessage('Constraints must be an object'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const response = await axios.post(`${AI_ML_SERVICE_URL}/schedule`, req.body, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      res.json(response.data);
    } catch (error) {
      console.error('AI/ML schedule error:', error.message);

      // Return mock schedule data if service unavailable
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        const { device_id } = req.body;
        const mockSchedule = {
          device_id,
          schedule: [
            { hour: 9, action: 'on', reason: 'Class start time' },
            { hour: 12, action: 'off', reason: 'Lunch break' },
            { hour: 13, action: 'on', reason: 'Afternoon classes' },
            { hour: 17, action: 'off', reason: 'End of day' }
          ],
          efficiency_gain: 15.5,
          timestamp: new Date().toISOString(),
          source: 'mock'
        };

        return res.json(mockSchedule);
      }

      res.status(error.response?.status || 500).json({
        error: 'AI/ML service error',
        message: error.response?.data?.message || error.message
      });
    }
  }
);

// Proxy anomaly detection requests
router.post('/anomaly',
  body('device_id').isString().notEmpty().withMessage('Device ID is required'),
  body('data').isArray().withMessage('Data must be an array'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const response = await axios.post(`${AI_ML_SERVICE_URL}/anomaly`, req.body, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      res.json(response.data);
    } catch (error) {
      console.error('AI/ML anomaly detection error:', error.message);

      // Return mock anomaly data if service unavailable
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        const { device_id } = req.body;
        const mockAnomalies = {
          device_id,
          anomalies: [],
          normal_range: { min: 10, max: 90 },
          confidence: 0.95,
          timestamp: new Date().toISOString(),
          source: 'mock',
          note: 'No anomalies detected (mock data)'
        };

        return res.json(mockAnomalies);
      }

      res.status(error.response?.status || 500).json({
        error: 'AI/ML service error',
        message: error.response?.data?.message || error.message
      });
    }
  }
);

// Health check for AI/ML service
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${AI_ML_SERVICE_URL}/health`, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.json({
      status: 'ok',
      ai_ml_service: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI/ML health check error:', error.message);

    res.status(503).json({
      status: 'error',
      ai_ml_service: 'unavailable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;