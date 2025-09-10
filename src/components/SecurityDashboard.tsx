import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Activity,
  Zap,
  Eye,
  UserX,
  TrendingUp,
  Timer
} from 'lucide-react';
import { securityAPI } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface SecurityAlert {
  _id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  deviceId?: {
    _id: string;
    name: string;
    location: string;
  };
  resolved: boolean;
  acknowledged: boolean;
  createdAt: string;
  resolvedAt?: string;
  acknowledgedAt?: string;
  resolution?: string;
}

interface SecurityMetric {
  _id: string;
  count: number;
  resolved: number;
  unresolved: number;
  avgResolutionTime: number;
}

export const SecurityDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [blacklist, setBlacklist] = useState<SecurityAlert[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetric[]>([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [alertFilter, setAlertFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, [timeRange, alertFilter]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAlerts(),
        fetchBlacklist(),
        fetchMetrics()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const params: any = {};
      if (alertFilter !== 'all') {
        if (alertFilter === 'resolved') params.resolved = 'true';
        if (alertFilter === 'unresolved') params.resolved = 'false';
        if (alertFilter === 'acknowledged') params.acknowledged = 'true';
      }
      
      const response = await securityAPI.getAlerts(params);
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchBlacklist = async () => {
    try {
      const response = await securityAPI.getBlacklist();
      setBlacklist(response.data);
    } catch (error) {
      console.error('Error fetching blacklist:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await securityAPI.getMetrics(timeRange);
      setMetrics(response.data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await securityAPI.acknowledgeAlert(alertId);
      toast({
        title: "Success",
        description: "Alert acknowledged successfully",
      });
      fetchAlerts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
        variant: "destructive",
      });
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await securityAPI.resolveAlert(alertId, "Resolved via dashboard");
      toast({
        title: "Success",
        description: "Alert resolved successfully",
      });
      fetchAlerts();
      fetchBlacklist();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-orange-500 text-white';
      case 'low': return 'bg-yellow-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'unauthorized_access': return <UserX className="w-4 h-4" />;
      case 'device_tampering': return <AlertTriangle className="w-4 h-4" />;
      case 'connection_failure': return <Zap className="w-4 h-4" />;
      case 'blacklist': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getTotalAlerts = () => metrics.reduce((sum, m) => sum + m.count, 0);
  const getTotalResolved = () => metrics.reduce((sum, m) => sum + m.resolved, 0);
  const getAvgResolutionTime = () => {
    const totalTime = metrics.reduce((sum, m) => sum + (m.avgResolutionTime || 0), 0);
    const metricsWithTime = metrics.filter(m => m.avgResolutionTime > 0).length;
    return metricsWithTime > 0 ? Math.round(totalTime / metricsWithTime / 1000 / 60) : 0; // in minutes
  };

  const unresolvedAlerts = alerts.filter(a => !a.resolved);
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.resolved);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Security Dashboard
          </h1>
          <p className="text-muted-foreground">Monitor and manage security alerts</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>{criticalAlerts.length}</strong> critical security alert{criticalAlerts.length !== 1 ? 's' : ''} require immediate attention!
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold">{getTotalAlerts()}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unresolved</p>
                <p className="text-2xl font-bold text-red-600">{unresolvedAlerts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{getTotalResolved()}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Resolution</p>
                <p className="text-2xl font-bold">{getAvgResolutionTime()}m</p>
              </div>
              <Timer className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklisted Devices</TabsTrigger>
          <TabsTrigger value="metrics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Security Alerts</CardTitle>
                <CardDescription>Recent security events and alerts</CardDescription>
              </div>
              <Select value={alertFilter} onValueChange={setAlertFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Alerts</SelectItem>
                  <SelectItem value="unresolved">Unresolved</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading alerts...</div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No security alerts found
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert._id}
                      className={`p-4 border rounded-lg ${
                        alert.severity === 'critical' ? 'border-red-200 bg-red-50' : 
                        alert.severity === 'high' ? 'border-orange-200 bg-orange-50' : 
                        'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getAlertIcon(alert.type)}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                              <span className="text-sm font-medium capitalize">
                                {alert.type.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                            {alert.deviceId && (
                              <p className="text-xs text-muted-foreground">
                                Device: {alert.deviceId.name} ({alert.deviceId.location})
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(alert.createdAt))} ago
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alert.resolved && (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                          {alert.acknowledged && !alert.resolved && (
                            <Badge variant="outline" className="text-blue-600">
                              <Eye className="w-3 h-3 mr-1" />
                              Acknowledged
                            </Badge>
                          )}
                          {!alert.resolved && (
                            <div className="flex gap-2">
                              {!alert.acknowledged && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAcknowledgeAlert(alert._id)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Acknowledge
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleResolveAlert(alert._id)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Resolve
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blacklist">
          <Card>
            <CardHeader>
              <CardTitle>Blacklisted Devices</CardTitle>
              <CardDescription>Devices currently blocked from system access</CardDescription>
            </CardHeader>
            <CardContent>
              {blacklist.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No devices currently blacklisted
                </div>
              ) : (
                <div className="space-y-3">
                  {blacklist.map((item) => (
                    <div key={item._id} className="p-4 border rounded-lg bg-red-50 border-red-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-red-800">
                            {item.deviceId?.name || 'Unknown Device'}
                          </h4>
                          <p className="text-sm text-red-600">{item.message}</p>
                          <p className="text-xs text-red-500 mt-1">
                            Blacklisted {formatDistanceToNow(new Date(item.createdAt))} ago
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveAlert(item._id)}
                          className="border-red-300 text-red-600 hover:bg-red-100"
                        >
                          Remove from Blacklist
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Security Analytics</CardTitle>
              <CardDescription>Security metrics and trends</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No metrics data available
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {metrics.map((metric) => (
                    <div key={metric._id} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2 capitalize flex items-center gap-2">
                        {getAlertIcon(metric._id)}
                        {metric._id.replace('_', ' ')}
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="text-lg font-semibold">{metric.count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Resolved</p>
                          <p className="text-lg font-semibold text-green-600">{metric.resolved}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Unresolved</p>
                          <p className="text-lg font-semibold text-red-600">{metric.unresolved}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Resolution</p>
                          <p className="text-lg font-semibold">
                            {metric.avgResolutionTime ? 
                              `${Math.round(metric.avgResolutionTime / 1000 / 60)}m` : 
                              'N/A'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityDashboard;
