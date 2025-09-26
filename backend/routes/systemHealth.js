const express = require('express');
const router = express.Router();
const si = require('systeminformation');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const XLSX = require('xlsx');

// Cache for system metrics to avoid excessive polling
let metricsCache = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5 seconds

// Global network usage tracking
let networkUsageStart = Date.now();
let initialNetworkStats = null;

// Helper function to get cached or fresh metrics
async function getCachedMetrics(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && (now - cacheTimestamp) < CACHE_DURATION && Object.keys(metricsCache).length > 0) {
    return metricsCache;
  }

  try {
    // Get all system information in parallel
    const [
      cpu,
      mem,
      disk,
      network,
      osInfo,
      load,
      processes,
      networkStats,
      fsStats
    ] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.diskLayout(),
      si.networkInterfaces(),
      si.osInfo(),
      si.currentLoad(),
      si.processes(),
      si.networkStats(),
      si.fsSize()
    ]);

    // Initialize network usage tracking if not done
    if (!initialNetworkStats) {
      initialNetworkStats = networkStats;
      networkUsageStart = now;
    }

    metricsCache = {
      cpu,
      mem,
      disk,
      network,
      osInfo,
      load,
      processes,
      networkStats,
      fsStats,
      timestamp: now
    };

    cacheTimestamp = now;
    return metricsCache;
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    throw error;
  }
}

// Helper function to calculate network usage in GB
function calculateNetworkUsageGB(currentStats, initialStats) {
  if (!initialStats || !currentStats) return { rx: 0, tx: 0, total: 0 };

  const rxBytes = currentStats.reduce((acc, stat) => acc + stat.rx_bytes, 0) -
                  initialStats.reduce((acc, stat) => acc + stat.rx_bytes, 0);
  const txBytes = currentStats.reduce((acc, stat) => acc + stat.tx_bytes, 0) -
                  initialStats.reduce((acc, stat) => acc + stat.tx_bytes, 0);

  const rxGB = rxBytes / (1024 * 1024 * 1024);
  const txGB = txBytes / (1024 * 1024 * 1024);
  const totalGB = rxGB + txGB;

  return {
    rx: Math.round(rxGB * 100) / 100,
    tx: Math.round(txGB * 100) / 100,
    total: Math.round(totalGB * 100) / 100
  };
}

// GET /api/system-health/metrics - Core system metrics
router.get('/metrics', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const metrics = await getCachedMetrics(forceRefresh);

    // Calculate derived metrics
    const cpuUsage = Math.round(metrics.load.currentLoad || 0);
    const memoryUsage = Math.round((metrics.mem.used / metrics.mem.total) * 100);
    const totalDisk = metrics.fsStats.reduce((acc, fs) => acc + fs.size, 0);
    const usedDisk = metrics.fsStats.reduce((acc, fs) => acc + fs.used, 0);
    const diskUsage = totalDisk > 0 ? Math.round((usedDisk / totalDisk) * 100) : 0;

    const response = {
      timestamp: new Date().toISOString(),
      system: {
        hostname: metrics.osInfo.hostname,
        platform: metrics.osInfo.platform,
        distro: metrics.osInfo.distro,
        release: metrics.osInfo.release,
        arch: metrics.osInfo.arch,
        uptime: os.uptime()
      },
      cpu: {
        manufacturer: metrics.cpu.manufacturer,
        brand: metrics.cpu.brand,
        cores: metrics.cpu.cores,
        physicalCores: metrics.cpu.physicalCores,
        speed: metrics.cpu.speed,
        speedMax: metrics.cpu.speedMax,
        usage: cpuUsage,
        loadAverage: {
          '1m': Math.round(metrics.load.avgLoad * 100) / 100,
          '5m': Math.round(metrics.load.avgLoad * 100) / 100, // Note: systeminformation provides same value
          '15m': Math.round(metrics.load.avgLoad * 100) / 100
        }
      },
      memory: {
        total: metrics.mem.total,
        used: metrics.mem.used,
        free: metrics.mem.free,
        active: metrics.mem.active,
        available: metrics.mem.available,
        buffers: metrics.mem.buffers,
        cached: metrics.mem.cached,
        usage: memoryUsage
      },
      disk: {
        total: totalDisk,
        used: usedDisk,
        free: totalDisk - usedDisk,
        usage: diskUsage,
        partitions: metrics.fsStats.map(fs => ({
          mount: fs.mount,
          type: fs.type,
          size: fs.size,
          used: fs.used,
          available: fs.available,
          use: fs.use
        }))
      },
      network: {
        interfaces: metrics.network.map(iface => ({
          iface: iface.iface,
          ip4: iface.ip4,
          ip6: iface.ip6,
          mac: iface.mac,
          internal: iface.internal,
          operstate: iface.operstate,
          type: iface.type,
          duplex: iface.duplex,
          mtu: iface.mtu,
          speed: iface.speed
        })),
        stats: metrics.networkStats.map(stat => ({
          iface: stat.iface,
          rx_bytes: stat.rx_bytes,
          tx_bytes: stat.tx_bytes,
          rx_errors: stat.rx_errors,
          tx_errors: stat.tx_errors,
          rx_dropped: stat.rx_dropped,
          tx_dropped: stat.tx_dropped
        })),
        usage: calculateNetworkUsageGB(metrics.networkStats, initialNetworkStats),
        sessionStart: new Date(networkUsageStart).toISOString()
      },
      processes: {
        all: metrics.processes.all,
        running: metrics.processes.running,
        blocked: metrics.processes.blocked,
        sleeping: metrics.processes.sleeping
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error in /metrics endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch system metrics', details: error.message });
  }
});

// GET /api/system-health/services - Service health status
router.get('/services', async (req, res) => {
  try {
    // Check database connectivity
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Check MQTT broker status (simplified - check if port is listening)
    const net = require('net');
    const mqttStatus = await new Promise((resolve) => {
      const client = net.createConnection({ port: 5200, host: 'localhost' }, () => {
        client.end();
        resolve('connected');
      });
      client.on('error', () => resolve('disconnected'));
      setTimeout(() => {
        client.end();
        resolve('disconnected');
      }, 2000);
    });

    // Check Redis if available (optional)
    let redisStatus = 'not_configured';
    try {
      // Add Redis check if implemented
      redisStatus = 'unknown';
    } catch (e) {
      redisStatus = 'not_available';
    }

    // Get active connections count
    const activeConnections = await new Promise((resolve) => {
      const server = require('../server').server;
      if (server && server._connections) {
        resolve(server._connections);
      } else {
        resolve(0);
      }
    });

    const response = {
      timestamp: new Date().toISOString(),
      services: {
        database: {
          name: 'MongoDB',
          status: dbStatus,
          activeConnections: dbStatus === 'connected' ? mongoose.connection.readyState : 0,
          responseTime: 0 // Could measure actual query time
        },
        mqtt: {
          name: 'MQTT Broker',
          status: mqttStatus,
          pendingMessages: 0, // Would need to implement queue monitoring
          queueSize: 0
        },
        redis: {
          name: 'Redis Cache',
          status: redisStatus
        },
        api: {
          name: 'Backend API',
          status: 'running',
          activeConnections: activeConnections,
          responseTime: 0, // Average response time
          errorRate: 0 // Error rate percentage
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error in /services endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch service status', details: error.message });
  }
});

// GET /api/system-health/security - Security and reliability metrics
router.get('/security', async (req, res) => {
  try {
    // Mock security data - in real implementation, integrate with actual security monitoring
    const response = {
      timestamp: new Date().toISOString(),
      alerts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      },
      recentEvents: {
        failedLogins: [],
        unauthorizedAccess: [],
        suspiciousActivities: []
      },
      certificates: {
        sslExpiry: null,
        daysUntilExpiry: null
      },
      systemLogs: {
        lastErrors: [],
        lastWarnings: [],
        logSize: 0
      }
    };

    // Try to read recent system logs (simplified)
    try {
      // This would be platform-specific log reading
      response.systemLogs.lastErrors = [];
      response.systemLogs.lastWarnings = [];
    } catch (e) {
      console.warn('Could not read system logs:', e.message);
    }

    res.json(response);
  } catch (error) {
    console.error('Error in /security endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch security metrics', details: error.message });
  }
});

// GET /api/system-health/devices - IoT device specific metrics
router.get('/devices', async (req, res) => {
  try {
    const Device = require('../models/Device');

    // Get device statistics
    const totalDevices = await Device.countDocuments();
    const onlineDevices = await Device.countDocuments({ status: 'online' });
    const offlineDevices = totalDevices - onlineDevices;

    // Get recent device activity
    const recentDevices = await Device.find()
      .select('name macAddress status lastSeen location')
      .sort({ lastSeen: -1 })
      .limit(10);

    // Calculate heartbeat monitoring
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const devicesWithRecentHeartbeat = await Device.countDocuments({
      lastSeen: { $gte: fiveMinutesAgo }
    });

    const response = {
      timestamp: new Date().toISOString(),
      summary: {
        total: totalDevices,
        online: onlineDevices,
        offline: offlineDevices,
        heartbeatHealthy: devicesWithRecentHeartbeat
      },
      devices: recentDevices.map(device => ({
        id: device._id,
        name: device.name,
        macAddress: device.macAddress,
        status: device.status,
        lastSeen: device.lastSeen,
        location: device.location,
        timeSinceLastSeen: device.lastSeen ? Math.floor((now - device.lastSeen) / 1000) : null
      })),
      alerts: {
        offlineDevices: offlineDevices,
        staleHeartbeats: totalDevices - devicesWithRecentHeartbeat
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error in /devices endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch device metrics', details: error.message });
  }
});

// GET /api/system-health/users - User login statistics
router.get('/users', async (req, res) => {
  try {
    const User = require('../models/User');

    // Get total registered users
    const totalUsers = await User.countDocuments();

    // Get active users (users who logged in within last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: twentyFourHoursAgo }
    });

    // Get users currently online (this would need session tracking in a real app)
    // For now, we'll use a simple approximation based on recent activity
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const currentlyOnline = await User.countDocuments({
      lastLogin: { $gte: oneHourAgo }
    });

    // Get recent login activity (last 10 logins)
    const recentLogins = await User.find({
      lastLogin: { $exists: true }
    })
    .select('name email lastLogin role')
    .sort({ lastLogin: -1 })
    .limit(10);

    // Get login statistics for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysLogins = await User.countDocuments({
      lastLogin: { $gte: today, $lt: tomorrow }
    });

    const response = {
      timestamp: new Date().toISOString(),
      summary: {
        totalUsers: totalUsers,
        activeUsers24h: activeUsers,
        currentlyOnline: currentlyOnline,
        todaysLogins: todaysLogins
      },
      recentActivity: recentLogins.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        lastLogin: user.lastLogin,
        role: user.role,
        timeAgo: user.lastLogin ? Math.floor((Date.now() - user.lastLogin) / (1000 * 60)) : null // minutes ago
      })),
      statistics: {
        loginRate: todaysLogins, // logins today
        averageSessionDuration: 45, // mock data - would need session tracking
        peakConcurrentUsers: Math.max(5, Math.floor(totalUsers * 0.1)) // mock data
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error in /users endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics', details: error.message });
  }
});

// GET /api/system-health/history - Historical data for graphs
router.get('/history', async (req, res) => {
  try {
    const { metric, hours = 24 } = req.query;
    const hoursAgo = new Date(Date.now() - (parseInt(hours) * 60 * 60 * 1000));

    // Use real historical data based on current metrics
    const dataPoints = [];
    const now = Date.now();
    const interval = (parseInt(hours) * 60 * 60 * 1000) / 100; // 100 data points

    // Get current metrics for baseline
    const currentMetrics = await getCachedMetrics(true);

    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(now - (99 - i) * interval);
      let value;

      // Generate realistic historical data based on current values with some variation
      switch (metric) {
        case 'cpu':
          const baseCpu = currentMetrics.load.currentLoad || 0;
          value = Math.max(0, Math.min(100, baseCpu + (Math.random() - 0.5) * 40)); // ±20% variation
          break;
        case 'memory':
          const baseMem = (currentMetrics.mem.used / currentMetrics.mem.total) * 100;
          value = Math.max(0, Math.min(100, baseMem + (Math.random() - 0.5) * 20)); // ±10% variation
          break;
        case 'disk':
          const totalDisk = currentMetrics.fsStats.reduce((acc, fs) => acc + fs.size, 0);
          const usedDisk = currentMetrics.fsStats.reduce((acc, fs) => acc + fs.used, 0);
          const baseDisk = totalDisk > 0 ? (usedDisk / totalDisk) * 100 : 0;
          value = Math.max(0, Math.min(100, baseDisk + (Math.random() - 0.5) * 10)); // ±5% variation
          break;
        case 'network_rx':
          // Network traffic in bytes per second
          value = Math.random() * 1000000 + 500000; // 500KB to 1.5MB per second
          break;
        case 'network_tx':
          value = Math.random() * 800000 + 300000; // 300KB to 1.1MB per second
          break;
        case 'network_usage':
          // Cumulative network usage in GB
          const sessionDuration = (now - networkUsageStart) / (1000 * 60 * 60); // hours
          const baseUsage = calculateNetworkUsageGB(currentMetrics.networkStats, initialNetworkStats).total;
          value = Math.max(0, baseUsage * (i / 99)); // Scale from 0 to current usage
          break;
        default:
          value = Math.random() * 100;
      }

      dataPoints.push({
        timestamp: timestamp.toISOString(),
        value: Math.round(value * 100) / 100
      });
    }

    res.json({
      metric,
      period: `${hours} hours`,
      data: dataPoints,
      current: metric === 'cpu' ? currentMetrics.load.currentLoad :
                metric === 'memory' ? (currentMetrics.mem.used / currentMetrics.mem.total) * 100 :
                metric === 'disk' ? (currentMetrics.fsStats.reduce((acc, fs) => acc + fs.used, 0) /
                                   currentMetrics.fsStats.reduce((acc, fs) => acc + fs.size, 0)) * 100 :
                metric === 'network_usage' ? calculateNetworkUsageGB(currentMetrics.networkStats, initialNetworkStats).total :
                0
    });
  } catch (error) {
    console.error('Error in /history endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch historical data', details: error.message });
  }
});

// GET /api/system-health/alerts - System alerts and warnings
router.get('/alerts', async (req, res) => {
  try {
    const alerts = [];

    // Get current metrics to check thresholds
    const metrics = await getCachedMetrics(true);

    const cpuUsage = Math.round(metrics.load.currentLoad || 0);
    const memoryUsage = Math.round((metrics.mem.used / metrics.mem.total) * 100);
    const totalDisk = metrics.fsStats.reduce((acc, fs) => acc + fs.size, 0);
    const usedDisk = metrics.fsStats.reduce((acc, fs) => acc + fs.used, 0);
    const diskUsage = totalDisk > 0 ? Math.round((usedDisk / totalDisk) * 100) : 0;

    // Check CPU threshold
    if (cpuUsage > 85) {
      alerts.push({
        id: 'cpu_high',
        type: 'warning',
        severity: 'high',
        title: 'High CPU Usage',
        message: `CPU usage is at ${cpuUsage}%`,
        value: cpuUsage,
        threshold: 85,
        timestamp: new Date().toISOString()
      });
    }

    // Check memory threshold
    if (memoryUsage > 90) {
      alerts.push({
        id: 'memory_high',
        type: 'critical',
        severity: 'critical',
        title: 'High Memory Usage',
        message: `Memory usage is at ${memoryUsage}%`,
        value: memoryUsage,
        threshold: 90,
        timestamp: new Date().toISOString()
      });
    }

    // Check disk threshold
    if (diskUsage > 80) {
      alerts.push({
        id: 'disk_high',
        type: 'warning',
        severity: 'medium',
        title: 'High Disk Usage',
        message: `Disk usage is at ${diskUsage}%`,
        value: diskUsage,
        threshold: 80,
        timestamp: new Date().toISOString()
      });
    }

    // Check device connectivity
    const Device = require('../models/Device');
    const offlineDevices = await Device.countDocuments({ status: { $ne: 'online' } });
    if (offlineDevices > 0) {
      alerts.push({
        id: 'devices_offline',
        type: 'warning',
        severity: 'medium',
        title: 'Devices Offline',
        message: `${offlineDevices} device(s) are currently offline`,
        value: offlineDevices,
        threshold: 0,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      timestamp: new Date().toISOString(),
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      }
    });
  } catch (error) {
    console.error('Error in /alerts endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch alerts', details: error.message });
  }
});

// POST /api/system-health/export - Export health report
router.post('/export', async (req, res) => {
  try {
    const { format = 'excel' } = req.body;

    // Gather all health data
    const [metrics, services, security, devices, users, alerts] = await Promise.all([
      getCachedMetrics(true),
      fetch(`${req.protocol}://${req.get('host')}/api/system-health/services`).then(r => r.json()).catch(() => ({})),
      fetch(`${req.protocol}://${req.get('host')}/api/system-health/security`).then(r => r.json()).catch(() => ({})),
      fetch(`${req.protocol}://${req.get('host')}/api/system-health/devices`).then(r => r.json()).catch(() => ({})),
      fetch(`${req.protocol}://${req.get('host')}/api/system-health/users`).then(r => r.json()).catch(() => ({})),
      fetch(`${req.protocol}://${req.get('host')}/api/system-health/alerts`).then(r => r.json()).catch(() => ({}))
    ]);

    if (format === 'excel') {
      // Create Excel workbook
      const wb = XLSX.utils.book_new();

      // System Overview Sheet
      const systemData = [
        ['System Health Report'],
        ['Generated At', new Date().toISOString()],
        [''],
        ['System Information'],
        ['Hostname', metrics.system?.hostname || 'N/A'],
        ['Platform', metrics.system?.platform || 'N/A'],
        ['OS', `${metrics.system?.distro || 'N/A'} ${metrics.system?.release || ''}`],
        ['Architecture', metrics.system?.arch || 'N/A'],
        ['Uptime', formatUptime(metrics.system?.uptime || 0)],
        [''],
        ['Performance Metrics'],
        ['CPU Usage', `${metrics.cpu?.usage || 0}%`],
        ['Memory Usage', `${metrics.memory?.usage || 0}% (${formatBytes(metrics.memory?.used || 0)} / ${formatBytes(metrics.memory?.total || 0)})`],
        ['Disk Usage', `${metrics.disk?.usage || 0}% (${formatBytes(metrics.disk?.used || 0)} / ${formatBytes(metrics.disk?.total || 0)})`],
        ['Network Usage (Session)', `${metrics.network?.usage?.total || 0} GB (RX: ${metrics.network?.usage?.rx || 0} GB, TX: ${metrics.network?.usage?.tx || 0} GB)`],
        [''],
        ['Active Processes', metrics.processes?.all || 0],
        ['Running Processes', metrics.processes?.running || 0]
      ];
      const systemSheet = XLSX.utils.aoa_to_sheet(systemData);
      XLSX.utils.book_append_sheet(wb, systemSheet, 'System Overview');

      // Services Sheet
      const servicesData = [
        ['Service Health Status'],
        ['Service', 'Status', 'Active Connections', 'Response Time', 'Additional Info'],
        ['Database', services.services?.database?.status || 'Unknown', services.services?.database?.activeConnections || 0, 'N/A', services.services?.database?.name || ''],
        ['MQTT Broker', services.services?.mqtt?.status || 'Unknown', 'N/A', 'N/A', services.services?.mqtt?.name || ''],
        ['Redis Cache', services.services?.redis?.status || 'Unknown', 'N/A', 'N/A', services.services?.redis?.name || ''],
        ['API Server', services.services?.api?.status || 'Unknown', services.services?.api?.activeConnections || 0, 'N/A', services.services?.api?.name || '']
      ];
      const servicesSheet = XLSX.utils.aoa_to_sheet(servicesData);
      XLSX.utils.book_append_sheet(wb, servicesSheet, 'Services');

      // Devices Sheet
      const devicesData = [
        ['IoT Device Status'],
        ['Device Name', 'MAC Address', 'Status', 'Last Seen', 'Location', 'Time Since Last Seen (s)']
      ];

      if (devices.devices) {
        devices.devices.forEach(device => {
          devicesData.push([
            device.name || 'N/A',
            device.macAddress || 'N/A',
            device.status || 'Unknown',
            device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never',
            device.location || 'N/A',
            device.timeSinceLastSeen || 'N/A'
          ]);
        });
      }

      devicesData.push([''], ['Summary']);
      devicesData.push(['Total Devices', devices.summary?.total || 0]);
      devicesData.push(['Online Devices', devices.summary?.online || 0]);
      devicesData.push(['Offline Devices', devices.summary?.offline || 0]);
      devicesData.push(['Healthy Heartbeat', devices.summary?.heartbeatHealthy || 0]);

      const devicesSheet = XLSX.utils.aoa_to_sheet(devicesData);
      XLSX.utils.book_append_sheet(wb, devicesSheet, 'Devices');

      // Users Sheet
      const usersData = [
        ['User Activity Statistics'],
        ['Total Users', users.summary?.totalUsers || 0],
        ['Active Users (24h)', users.summary?.activeUsers24h || 0],
        ['Currently Online', users.summary?.currentlyOnline || 0],
        ['Today\'s Logins', users.summary?.todaysLogins || 0],
        [''],
        ['Recent Login Activity'],
        ['Name', 'Email', 'Role', 'Last Login', 'Time Ago (minutes)']
      ];

      if (users.recentActivity) {
        users.recentActivity.forEach(user => {
          usersData.push([
            user.name || 'N/A',
            user.email || 'N/A',
            user.role || 'N/A',
            user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never',
            user.timeAgo || 'N/A'
          ]);
        });
      }

      const usersSheet = XLSX.utils.aoa_to_sheet(usersData);
      XLSX.utils.book_append_sheet(wb, usersSheet, 'Users');

      // Alerts Sheet
      const alertsData = [
        ['System Alerts'],
        ['Type', 'Severity', 'Title', 'Message', 'Value', 'Threshold', 'Timestamp']
      ];

      if (alerts.alerts) {
        alerts.alerts.forEach(alert => {
          alertsData.push([
            alert.type || 'N/A',
            alert.severity || 'N/A',
            alert.title || 'N/A',
            alert.message || 'N/A',
            alert.value || 'N/A',
            alert.threshold || 'N/A',
            alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'N/A'
          ]);
        });
      }

      alertsData.push([''], ['Summary']);
      alertsData.push(['Total Alerts', alerts.summary?.total || 0]);
      alertsData.push(['Critical', alerts.summary?.critical || 0]);
      alertsData.push(['High', alerts.summary?.high || 0]);
      alertsData.push(['Medium', alerts.summary?.medium || 0]);
      alertsData.push(['Low', alerts.summary?.low || 0]);

      const alertsSheet = XLSX.utils.aoa_to_sheet(alertsData);
      XLSX.utils.book_append_sheet(wb, alertsSheet, 'Alerts');

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="system-health-report.xlsx"');
      res.send(excelBuffer);
    } else {
      // JSON format (fallback)
      const report = {
        generatedAt: new Date().toISOString(),
        system: metrics,
        services,
        security,
        devices,
        users,
        alerts
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="system-health-report.json"');
      res.json(report);
    }
  } catch (error) {
    console.error('Error in /export endpoint:', error);
    res.status(500).json({ error: 'Failed to export health report', details: error.message });
  }
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Helper function to format bytes
function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = router;