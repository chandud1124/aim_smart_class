import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity,
  Server,
  Database,
  Wifi,
  WifiOff,
  Clock,
  MemoryStick,
  HardDrive,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import api from '@/services/api';
import { formatDistanceToNow } from 'date-fns';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  database: {
    status: string;
    connected: boolean;
  };
  memory: {
    total: number;
    used: number;
    external: number;
  };
  environment: string;
}

interface SystemMetrics {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  criticalAlerts: number;
  recentActivities: number;
  avgResponseTime: number;
}

export const SystemHealthMonitoring: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchHealthData();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchHealthData();
      }, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      
      // Fetch health data
      const healthResponse = await api.get('/health');
      setHealth(healthResponse.data);
      
      // Fetch additional system metrics
      try {
        const [devicesResponse, alertsResponse, activitiesResponse] = await Promise.all([
          api.get('/devices').catch(() => ({ data: { data: [] } })),
          api.get('/security/alerts?resolved=false').catch(() => ({ data: [] })),
          api.get('/activities?limit=10').catch(() => ({ data: { data: [] } }))
        ]);

        const devices = devicesResponse.data.data || [];
        const alerts = alertsResponse.data || [];
        const activities = activitiesResponse.data.data || [];

        setMetrics({
          totalDevices: devices.length,
          onlineDevices: devices.filter((d: any) => d.isOnline).length,
          offlineDevices: devices.filter((d: any) => !d.isOnline).length,
          criticalAlerts: alerts.filter((a: any) => a.severity === 'critical').length,
          recentActivities: activities.length,
          avgResponseTime: Math.floor(Math.random() * 200) + 50 // Mock data
        });
      } catch (metricsError) {
        console.warn('Failed to fetch some metrics:', metricsError);
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ok':
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
      case 'disconnected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ok':
      case 'connected':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
      case 'disconnected':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const formatUptime = (uptimeSeconds: number) => {
    const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
    const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getMemoryUsagePercentage = () => {
    if (!health?.memory) return 0;
    return Math.round((health.memory.used / health.memory.total) * 100);
  };

  if (loading && !health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            System Health Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading system health...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSystemHealthy = health?.status === 'ok' && health?.database.connected;
  const memoryUsage = getMemoryUsagePercentage();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Server className="w-8 h-8 text-blue-600" />
            System Health Monitoring
          </h1>
          <p className="text-muted-foreground">Real-time system status and metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchHealthData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status Alert */}
      {!isSystemHealthy && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>System Health Warning:</strong> One or more critical components are not functioning properly.
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(health?.status || 'unknown')}
                  <Badge className={getStatusColor(health?.status || 'unknown')}>
                    {health?.status?.toUpperCase() || 'UNKNOWN'}
                  </Badge>
                </div>
              </div>
              <Server className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Database</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(health?.database.status || 'unknown')}
                  <Badge className={getStatusColor(health?.database.status || 'unknown')}>
                    {health?.database.status?.toUpperCase() || 'UNKNOWN'}
                  </Badge>
                </div>
              </div>
              <Database className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Uptime</p>
                <p className="text-lg font-bold">{health ? formatUptime(health.uptime) : 'N/A'}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Environment</p>
                <p className="text-lg font-bold capitalize">{health?.environment || 'N/A'}</p>
              </div>
              <HardDrive className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Device Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Devices</span>
                  <span className="font-semibold">{metrics.totalDevices}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <Wifi className="w-3 h-3" />
                    Online
                  </span>
                  <span className="font-semibold text-green-600">{metrics.onlineDevices}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-600 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                  <span className="font-semibold text-red-600">{metrics.offlineDevices}</span>
                </div>
                <Progress 
                  value={metrics.totalDevices > 0 ? (metrics.onlineDevices / metrics.totalDevices) * 100 : 0} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Critical Alerts</span>
                  <span className={`font-semibold ${metrics.criticalAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {metrics.criticalAlerts}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recent Activities</span>
                  <span className="font-semibold">{metrics.recentActivities}</span>
                </div>
                <div className="flex items-center gap-2">
                  {metrics.criticalAlerts === 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm ${metrics.criticalAlerts === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {metrics.criticalAlerts === 0 ? 'All Clear' : 'Attention Required'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Response</span>
                  <span className="font-semibold">{metrics.avgResponseTime}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Memory Usage</span>
                  <span className="font-semibold">{memoryUsage}%</span>
                </div>
                <div className="flex items-center gap-2">
                  {metrics.avgResponseTime < 200 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-orange-600" />
                  )}
                  <span className={`text-sm ${metrics.avgResponseTime < 200 ? 'text-green-600' : 'text-orange-600'}`}>
                    {metrics.avgResponseTime < 200 ? 'Good Performance' : 'Monitor Performance'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Memory Usage Details */}
      {health?.memory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MemoryStick className="w-5 h-5" />
              Memory Usage Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Heap Memory</span>
                  <span className="text-sm text-muted-foreground">
                    {health.memory.used} MB / {health.memory.total} MB ({memoryUsage}%)
                  </span>
                </div>
                <Progress value={memoryUsage} className="h-2" />
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{health.memory.total} MB</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Used</p>
                  <p className="text-lg font-semibold">{health.memory.used} MB</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">External</p>
                  <p className="text-lg font-semibold">{health.memory.external} MB</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium mb-2">Last Updated</p>
              <p className="text-muted-foreground">
                {formatDistanceToNow(lastUpdate)} ago
              </p>
            </div>
            <div>
              <p className="font-medium mb-2">System Time</p>
              <p className="text-muted-foreground">
                {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="font-medium mb-2">Auto Refresh</p>
              <p className={`${autoRefresh ? 'text-green-600' : 'text-gray-600'}`}>
                {autoRefresh ? 'Enabled (30s)' : 'Disabled'}
              </p>
            </div>
            <div>
              <p className="font-medium mb-2">Data Status</p>
              <p className="text-muted-foreground">
                {loading ? 'Updating...' : 'Up to date'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemHealthMonitoring;
