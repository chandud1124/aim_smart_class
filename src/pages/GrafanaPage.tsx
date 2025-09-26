import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertCircle, Activity, Zap, Users, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';

const GrafanaPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardStatus, setDashboardStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [activeTab, setActiveTab] = useState('overview');

  const grafanaUrl = import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000';
  const prometheusUrl = import.meta.env.VITE_PROMETHEUS_URL || 'http://localhost:9090';

  // Check Grafana health
  const checkGrafanaHealth = async () => {
    try {
      const response = await fetch(`${grafanaUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setDashboardStatus(response.ok ? 'online' : 'offline');
    } catch (error) {
      setDashboardStatus('offline');
    }
  };

  useEffect(() => {
    checkGrafanaHealth();
    const interval = setInterval(checkGrafanaHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const refreshDashboard = () => {
    setIsLoading(true);
    // Force iframe refresh
    const iframe = document.getElementById('grafana-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
    setTimeout(() => setIsLoading(false), 2000);
  };

  const dashboardCards = [
    {
      title: 'System Overview',
      description: 'Real-time system health and performance metrics',
      icon: <Activity className="h-5 w-5" />,
      url: `${grafanaUrl}/d/classroom-usage`,
      color: 'bg-blue-500'
    },
    {
      title: 'Energy Analytics',
      description: 'Power consumption and energy cost analysis',
      icon: <Zap className="h-5 w-5" />,
      url: `${grafanaUrl}/d/energy-analytics`,
      color: 'bg-green-500'
    },
    {
      title: 'Device Monitoring',
      description: 'IoT device status and health monitoring',
      icon: <TrendingUp className="h-5 w-5" />,
      url: `${grafanaUrl}/d/device-health`,
      color: 'bg-purple-500'
    },
    {
      title: 'Classroom Utilization',
      description: 'Occupancy and classroom usage patterns',
      icon: <Users className="h-5 w-5" />,
      url: `${grafanaUrl}/d/occupancy-dashboard`,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">Grafana Analytics Dashboard</h1>
          <p className="text-gray-600">Advanced monitoring and visualization for your IoT Classroom System</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={dashboardStatus === 'online' ? 'default' : 'destructive'}
            className="flex items-center gap-2"
          >
            <div className={`w-2 h-2 rounded-full ${dashboardStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
            Grafana {dashboardStatus === 'online' ? 'Online' : 'Offline'}
          </Badge>
          <Button
            onClick={refreshDashboard}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {dashboardStatus === 'offline' && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-800">Grafana Service Unavailable</h3>
                <p className="text-sm text-yellow-700">
                  The Grafana dashboard service is currently offline. Please check that the monitoring stack is running.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Dashboard Overview</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Analytics</TabsTrigger>
          <TabsTrigger value="raw">Raw Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboardCards.map((card, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${card.color} text-white`}>
                      {card.icon}
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  <CardDescription className="text-sm">{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(card.url, '_blank')}
                    disabled={dashboardStatus !== 'online'}
                  >
                    Open Dashboard
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>IoT Classroom Monitoring Dashboard</CardTitle>
              <CardDescription>
                Comprehensive real-time monitoring of your classroom IoT system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-gray-50 min-h-[600px] relative">
                {dashboardStatus === 'online' ? (
                  <iframe
                    id="grafana-iframe"
                    src={`${grafanaUrl}/d/classroom-usage`}
                    width="100%"
                    height="600"
                    frameBorder="0"
                    title="IoT Classroom Grafana Dashboard"
                    className="rounded"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">Dashboard Unavailable</h3>
                      <p className="text-gray-500">
                        Grafana service is offline. Please start the monitoring stack to view analytics.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Energy Consumption Trends</CardTitle>
                <CardDescription>24-hour energy usage patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-gray-50 min-h-[400px]">
                  {dashboardStatus === 'online' ? (
                    <iframe
                      src={`${grafanaUrl}/d/energy-analytics`}
                      width="100%"
                      height="400"
                      frameBorder="0"
                      title="Energy Analytics"
                      className="rounded"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Service offline
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device Health Status</CardTitle>
                <CardDescription>Real-time device monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-gray-50 min-h-[400px]">
                  {dashboardStatus === 'online' ? (
                    <iframe
                      src={`${grafanaUrl}/d/device-health`}
                      width="100%"
                      height="400"
                      frameBorder="0"
                      title="Device Health"
                      className="rounded"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Service offline
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Classroom Occupancy Analytics</CardTitle>
              <CardDescription>Utilization patterns and occupancy trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-gray-50 min-h-[500px]">
                {dashboardStatus === 'online' ? (
                  <iframe
                    src={`${grafanaUrl}/d/occupancy-dashboard`}
                    width="100%"
                    height="500"
                    frameBorder="0"
                    title="Occupancy Dashboard"
                    className="rounded"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Service offline
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prometheus Metrics Explorer</CardTitle>
              <CardDescription>Raw metrics data and query interface</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-gray-50 min-h-[600px]">
                <iframe
                  src={prometheusUrl}
                  width="100%"
                  height="600"
                  frameBorder="0"
                  title="Prometheus Metrics"
                  className="rounded"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`${grafanaUrl}/alerting/list`, '_blank')}
          >
            View Alerts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`${grafanaUrl}/datasources`, '_blank')}
          >
            Data Sources
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`${grafanaUrl}/admin/settings`, '_blank')}
          >
            Grafana Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GrafanaPage;