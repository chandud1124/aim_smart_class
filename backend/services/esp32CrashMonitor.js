const fs = require('fs');
const path = require('path');

// ESP32 Crash Detection and Monitoring Script
// This script monitors ESP32 connections and detects potential crashes

class ESP32CrashMonitor {
  constructor() {
    this.devices = new Map();
    this.crashLog = [];
    this.isMonitoring = false;
    
    // Thresholds for crash detection
    this.HEARTBEAT_TIMEOUT = 60000; // 60 seconds
    this.RECONNECT_THRESHOLD = 5; // 5 reconnections in short period indicates issues
    this.RECONNECT_WINDOW = 300000; // 5 minutes window
  }

  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('[CRASH-MONITOR] ESP32 crash monitoring started');
    
    // Monitor devices every 30 seconds
    setInterval(() => {
      this.checkDeviceHealth();
    }, 30000);
    
    // Write crash report every hour
    setInterval(() => {
      this.generateCrashReport();
    }, 3600000);
  }

  registerDevice(mac, socket) {
    const now = Date.now();
    
    if (this.devices.has(mac)) {
      const device = this.devices.get(mac);
      device.reconnectCount++;
      device.lastReconnect = now;
      device.socket = socket;
      device.status = 'connected';
      
      // Check for rapid reconnections (potential crash indicator)
      const recentReconnects = device.reconnectHistory.filter(
        time => now - time < this.RECONNECT_WINDOW
      );
      
      if (recentReconnects.length >= this.RECONNECT_THRESHOLD) {
        this.reportSuspiciousActivity(mac, 'rapid_reconnections', {
          count: recentReconnects.length,
          timeWindow: this.RECONNECT_WINDOW / 1000
        });
      }
      
      device.reconnectHistory.push(now);
      
      console.log(`[CRASH-MONITOR] Device ${mac} reconnected (${device.reconnectCount} total reconnections)`);
    } else {
      this.devices.set(mac, {
        mac,
        socket,
        firstSeen: now,
        lastSeen: now,
        lastHeartbeat: now,
        lastReconnect: now,
        reconnectCount: 0,
        reconnectHistory: [now],
        status: 'connected',
        suspiciousEvents: []
      });
      
      console.log(`[CRASH-MONITOR] New device registered: ${mac}`);
    }
  }

  updateHeartbeat(mac) {
    if (this.devices.has(mac)) {
      const device = this.devices.get(mac);
      device.lastHeartbeat = Date.now();
      device.lastSeen = Date.now();
      device.status = 'healthy';
    }
  }

  deviceDisconnected(mac, reason = 'unknown') {
    if (this.devices.has(mac)) {
      const device = this.devices.get(mac);
      device.status = 'disconnected';
      device.lastDisconnect = Date.now();
      device.lastDisconnectReason = reason;
      
      // Calculate uptime
      const uptime = Date.now() - device.lastReconnect;
      
      // Check if disconnect might indicate a crash
      if (uptime < 30000) { // Less than 30 seconds uptime
        this.reportSuspiciousActivity(mac, 'short_uptime', {
          uptime: uptime / 1000,
          reason
        });
      }
      
      if (reason === 'ping timeout' || reason === 'transport close') {
        this.reportSuspiciousActivity(mac, 'unexpected_disconnect', {
          uptime: uptime / 1000,
          reason
        });
      }
      
      console.log(`[CRASH-MONITOR] Device ${mac} disconnected: ${reason} (uptime: ${uptime/1000}s)`);
    }
  }

  checkDeviceHealth() {
    const now = Date.now();
    
    for (const [mac, device] of this.devices) {
      if (device.status === 'connected' || device.status === 'healthy') {
        // Check for missed heartbeats
        const timeSinceHeartbeat = now - device.lastHeartbeat;
        
        if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT) {
          device.status = 'unresponsive';
          this.reportSuspiciousActivity(mac, 'missed_heartbeat', {
            timeSinceHeartbeat: timeSinceHeartbeat / 1000
          });
          
          console.log(`[CRASH-MONITOR] Device ${mac} appears unresponsive (${timeSinceHeartbeat/1000}s since heartbeat)`);
        }
      }
    }
  }

  reportSuspiciousActivity(mac, type, details) {
    const event = {
      timestamp: new Date().toISOString(),
      mac,
      type,
      details
    };
    
    // Add to device's suspicious events
    if (this.devices.has(mac)) {
      this.devices.get(mac).suspiciousEvents.push(event);
    }
    
    // Add to global crash log
    this.crashLog.push(event);
    
    console.log(`[CRASH-MONITOR] SUSPICIOUS ACTIVITY - ${mac}: ${type}`, details);
    
    // Keep only last 1000 events to prevent memory issues
    if (this.crashLog.length > 1000) {
      this.crashLog = this.crashLog.slice(-1000);
    }
  }

  generateCrashReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDevices: this.devices.size,
        connectedDevices: Array.from(this.devices.values()).filter(d => d.status === 'connected' || d.status === 'healthy').length,
        suspiciousEvents: this.crashLog.length
      },
      devices: {},
      recentEvents: this.crashLog.slice(-50) // Last 50 events
    };
    
    // Device-specific reports
    for (const [mac, device] of this.devices) {
      const uptime = device.status === 'connected' || device.status === 'healthy' 
        ? Date.now() - device.lastReconnect 
        : 0;
      
      report.devices[mac] = {
        status: device.status,
        uptime: uptime / 1000,
        totalReconnects: device.reconnectCount,
        suspiciousEvents: device.suspiciousEvents.length,
        lastSeen: new Date(device.lastSeen).toISOString()
      };
    }
    
    // Write report to file
    const reportPath = path.join(__dirname, 'esp32_crash_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`[CRASH-MONITOR] Crash report generated: ${reportPath}`);
    
    // Log summary
    console.log(`[CRASH-MONITOR] SUMMARY - ${report.summary.connectedDevices}/${report.summary.totalDevices} devices healthy, ${report.summary.suspiciousEvents} suspicious events detected`);
  }

  getDeviceStats(mac) {
    if (!this.devices.has(mac)) {
      return null;
    }
    
    const device = this.devices.get(mac);
    const now = Date.now();
    
    return {
      mac,
      status: device.status,
      uptime: device.status === 'connected' || device.status === 'healthy' 
        ? (now - device.lastReconnect) / 1000 
        : 0,
      totalUptime: (now - device.firstSeen) / 1000,
      reconnectCount: device.reconnectCount,
      suspiciousEvents: device.suspiciousEvents.length,
      lastHeartbeat: new Date(device.lastHeartbeat).toISOString(),
      recentEvents: device.suspiciousEvents.slice(-10)
    };
  }
}

module.exports = ESP32CrashMonitor;
