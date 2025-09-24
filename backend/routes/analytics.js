// routes/analytics.js
// Analytics routes for Prometheus metrics and Grafana dashboard data

const express = require('express');
const router = express.Router();
const metricsService = require('../metricsService');
const { handleValidationErrors } = require('../middleware/validationHandler');
const { param } = require('express-validator');

// Get Prometheus metrics
router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsService.getContentType());
    res.end(await metricsService.getMetrics());
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Get analytics dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = await metricsService.getDashboardData();
    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// Get energy consumption data
router.get('/energy/:timeframe', 
  param('timeframe').isIn(['1h', '24h', '7d', '30d', '90d']).withMessage('Invalid timeframe'),
  handleValidationErrors,
  async (req, res) => {
  try {
    const { timeframe } = req.params;
    const energyData = await metricsService.getEnergyData(timeframe);
    res.json(energyData);
  } catch (error) {
    console.error('Error getting energy data:', error);
    res.status(500).json({ error: 'Failed to get energy data' });
  }
});

// Get device health data
router.get('/health/:deviceId?', 
  param('deviceId').optional().isMongoId().withMessage('Invalid device ID'),
  handleValidationErrors,
  async (req, res) => {
  try {
    const { deviceId } = req.params;
    const healthData = await metricsService.getDeviceHealth(deviceId);
    res.json(healthData);
  } catch (error) {
    console.error('Error getting device health data:', error);
    res.status(500).json({ error: 'Failed to get device health data' });
  }
});

// Get occupancy data
router.get('/occupancy/:classroomId?', 
  param('classroomId').optional().isString().isLength({ min: 1 }).withMessage('Invalid classroom ID'),
  handleValidationErrors,
  async (req, res) => {
  try {
    const { classroomId } = req.params;
    const occupancyData = await metricsService.getOccupancyData(classroomId);
    res.json(occupancyData);
  } catch (error) {
    console.error('Error getting occupancy data:', error);
    res.status(500).json({ error: 'Failed to get occupancy data' });
  }
});

// Get anomaly history
router.get('/anomalies/:timeframe?', 
  param('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe'),
  handleValidationErrors,
  async (req, res) => {
  try {
    const { timeframe = '7d' } = req.params;
    const anomalyData = await metricsService.getAnomalyHistory(timeframe);
    res.json(anomalyData);
  } catch (error) {
    console.error('Error getting anomaly data:', error);
    res.status(500).json({ error: 'Failed to get anomaly data' });
  }
});

// Get forecasting data
router.get('/forecast/:type/:timeframe', 
  param('type').isIn(['energy', 'occupancy', 'health']).withMessage('Invalid forecast type'),
  param('timeframe').isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe'),
  handleValidationErrors,
  async (req, res) => {
  try {
    const { type, timeframe } = req.params;
    const forecastData = await metricsService.getForecastData(type, timeframe);
    res.json(forecastData);
  } catch (error) {
    console.error('Error getting forecast data:', error);
    res.status(500).json({ error: 'Failed to get forecast data' });
  }
});

// Get predictive maintenance data
router.get('/predictive-maintenance', async (req, res) => {
  try {
    const maintenanceData = await metricsService.getPredictiveMaintenance();
    res.json(maintenanceData);
  } catch (error) {
    console.error('Error getting predictive maintenance data:', error);
    res.status(500).json({ error: 'Failed to get predictive maintenance data' });
  }
});

// Get real-time metrics for Grafana-style dashboard
router.get('/realtime-metrics', async (req, res) => {
  try {
    const realtimeData = await metricsService.getRealtimeMetrics();
    res.json(realtimeData);
  } catch (error) {
    console.error('Error getting realtime metrics:', error);
    res.status(500).json({ error: 'Failed to get realtime metrics' });
  }
});

// Get comparative analytics
router.get('/comparative/:period1/:period2', async (req, res) => {
  try {
    const { period1, period2 } = req.params;
    const comparativeData = await metricsService.getComparativeAnalytics(period1, period2);
    res.json(comparativeData);
  } catch (error) {
    console.error('Error getting comparative analytics:', error);
    res.status(500).json({ error: 'Failed to get comparative analytics' });
  }
});

// Get efficiency metrics
router.get('/efficiency/:timeframe', async (req, res) => {
  try {
    const { timeframe } = req.params;
    const efficiencyData = await metricsService.getEfficiencyMetrics(timeframe);
    res.json(efficiencyData);
  } catch (error) {
    console.error('Error getting efficiency metrics:', error);
    res.status(500).json({ error: 'Failed to get efficiency metrics' });
  }
});

// Get device usage patterns
router.get('/device-usage/:timeframe', 
  param('timeframe').isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe'),
  handleValidationErrors,
  async (req, res) => {
  try {
    const { timeframe } = req.params;
    const usageData = await metricsService.getDeviceUsageData(timeframe);
    res.json(usageData);
  } catch (error) {
    console.error('Error getting device usage data:', error);
    res.status(500).json({ error: 'Failed to get device usage data' });
  }
});

// Get behavioral analysis data
router.get('/behavioral-analysis/:deviceId?', 
  param('deviceId').optional().isMongoId().withMessage('Invalid device ID'),
  handleValidationErrors,
  async (req, res) => {
  try {
    const { deviceId } = req.params;
    // Use ActivityLog for behavioral analysis
    const ActivityLog = require('../models/ActivityLog');
    
    let query = {};
    if (deviceId) {
      query.deviceId = deviceId;
    }
    
    const activities = await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(1000)
      .lean();
    
    // Analyze patterns
    const patterns = {
      totalActivities: activities.length,
      byAction: {},
      byHour: new Array(24).fill(0),
      byDay: {},
      mostActiveDevice: null,
      peakHours: [],
      usagePatterns: []
    };
    
    activities.forEach(activity => {
      // Count by action
      if (!patterns.byAction[activity.action]) {
        patterns.byAction[activity.action] = 0;
      }
      patterns.byAction[activity.action]++;
      
      // Count by hour
      const hour = new Date(activity.timestamp).getHours();
      patterns.byHour[hour]++;
      
      // Count by day
      const day = new Date(activity.timestamp).toDateString();
      if (!patterns.byDay[day]) {
        patterns.byDay[day] = 0;
      }
      patterns.byDay[day]++;
    });
    
    // Find peak hours
    const avgHourlyActivity = patterns.byHour.reduce((a, b) => a + b, 0) / 24;
    patterns.peakHours = patterns.byHour
      .map((count, hour) => ({ hour, count }))
      .filter(item => item.count > avgHourlyActivity * 1.5)
      .map(item => item.hour);
    
    res.json(patterns);
  } catch (error) {
    console.error('Error getting behavioral analysis data:', error);
    res.status(500).json({ error: 'Failed to get behavioral analysis data' });
  }
});

module.exports = router;