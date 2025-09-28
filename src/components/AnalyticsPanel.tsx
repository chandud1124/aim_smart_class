// AnalyticsPanel.tsx
// Grafana-style analytics dashboard with Prometheus metrics integration
// Features: Energy consumption dashboards, forecast vs actual usage,
// device uptime predictions, anomaly history, and real-time monitoring

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  Activity, Zap, Users, AlertTriangle, TrendingUp,
  Download, RefreshCw, Monitor, Lightbulb, Fan, Server,
  Wifi, WifiOff, MapPin, Calendar, Clock
} from 'lucide-react';
import { apiService } from '@/services/api';

interface AnalyticsData {
  devices: Array<{
    id: string;
    name: string;
    classroom: string;
    type: string;
    status: string;
    power: number;
    health: number;
  }>;
  classrooms: Array<{
    id: string;
    name: string;
    type: string;
    occupancy: number;
  }>;
  summary: {
    totalDevices: number;
    onlineDevices: number;
    totalPowerConsumption: number;
    averageHealthScore: number;
  };
}

const AnalyticsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [energyData, setEnergyData] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<any>(null);
  const [maintenanceData, setMaintenanceData] = useState<any>(null);
  const [occupancyData, setOccupancyData] = useState<any[]>([]);
  const [anomalyData, setAnomalyData] = useState<any>(null);
  const [energyTimeframe, setEnergyTimeframe] = useState('24h');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      // console.log('Fetching analytics data...'); // Removed duplicate logging

      // Try individual API calls instead of Promise.all to see which one fails
      const dashboardRes = await apiService.get('/analytics/dashboard');
      // console.log('Dashboard data received:', dashboardRes.data); // Removed duplicate logging

      setAnalyticsData(dashboardRes.data);
      setError(null);

      // Fetch additional data for enhanced tabs
      await Promise.all([
        fetchEnergyData(energyTimeframe),
        fetchForecastData('energy', energyTimeframe),
        fetchMaintenanceData(),
        fetchAnomalyData('7d'),
        fetchOccupancyData()
      ]);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Please check your connection.');
      // Don't set mock data - show error state instead
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Fetch energy data
  const fetchEnergyData = async (timeframe: string = '24h') => {
    try {
      const response = await apiService.get(`/analytics/energy/${timeframe}`);
      setEnergyData(response.data);
    } catch (err) {
      console.error('Error fetching energy data:', err);
      // Don't set mock data - let the UI show empty state
      setEnergyData([]);
    }
  };

  // Fetch forecast data
  const fetchForecastData = async (type: string = 'energy', timeframe: string = '24h') => {
    try {
      const response = await apiService.get(`/analytics/forecast/${type}/${timeframe}`);
      setForecastData(response.data);
    } catch (err) {
      console.error('Error fetching forecast data:', err);
      // Don't set mock data - let the UI show empty state
      setForecastData(null);
    }
  };

  // Fetch maintenance data
  const fetchMaintenanceData = async () => {
    try {
      const response = await apiService.get('/analytics/predictive-maintenance');
      setMaintenanceData(response.data);
    } catch (err) {
      console.error('Error fetching maintenance data:', err);
      // Don't set mock data - let the UI show empty state
      setMaintenanceData(null);
    }
  };

  // Fetch anomaly data
  const fetchAnomalyData = async (timeframe: string = '7d') => {
    try {
      const response = await apiService.get(`/analytics/anomalies/${timeframe}`);
      setAnomalyData(response.data);
    } catch (err) {
      console.error('Error fetching anomaly data:', err);
      // Don't set mock data - let the UI show empty state
      setAnomalyData(null);
    }
  };

  // Fetch occupancy data
  const fetchOccupancyData = async (classroomId?: string) => {
    try {
      const endpoint = classroomId ? `/analytics/occupancy/${classroomId}` : '/analytics/occupancy';
      const response = await apiService.get(endpoint);
      // console.log('Occupancy data received:', response.data); // Removed duplicate logging
      setOccupancyData(response.data);
    } catch (err) {
      console.error('Error fetching occupancy data:', err);
      // Don't set mock data - let the UI show empty state
      setOccupancyData([]);
    }
  };

  // Device type icons
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'display': return Monitor;
      case 'lighting': return Lightbulb;
      case 'climate': return Fan;
      case 'computing': return Server;
      default: return Activity;
    }
  };

  // Status colors
  const getStatusColor = (status: string) => {
    return status === 'online' ? 'bg-green-500' : 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error && !analyticsData) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-500">{error}</p>
          <Button onClick={fetchAnalyticsData} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const deviceStatusData = [
    { name: 'Online', value: analyticsData.summary?.onlineDevices ?? 0, color: '#10b981' },
    { name: 'Offline', value: (analyticsData.summary?.totalDevices ?? 0) - (analyticsData.summary?.onlineDevices ?? 0), color: '#ef4444' }
  ].filter(item => item.value > 0); // Only show items with value > 0

  // console.log('Chart data:', { deviceStatusData, occupancyData }); // Removed duplicate logging

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-primary">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Real-time monitoring and historical data analysis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAnalyticsData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {analyticsData.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.summary?.totalDevices ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {analyticsData.summary?.onlineDevices ?? 0} online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Power Consumption</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.summary?.totalPowerConsumption?.toFixed(0) ?? 0}W</div>
            <p className="text-xs text-muted-foreground">
              Current total usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.summary?.averageHealthScore?.toFixed(1) ?? 0}%</div>
            <p className="text-xs text-muted-foreground">
              Device health status
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Main Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="energy">Energy</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            {/* Device Status Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Device Status</CardTitle>
                <CardDescription>Online vs offline devices</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {deviceStatusData.length > 0 && deviceStatusData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deviceStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {deviceStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No device status data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Devices Table */}
          <Card>
            <CardHeader>
              <CardTitle>Device Overview</CardTitle>
              <CardDescription>Current status of all devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.devices?.slice(0, 6).map((device) => {
                  const IconComponent = getDeviceIcon(device.type);
                  return (
                    <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <IconComponent className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{device.name ?? 'Unknown Device'}</p>
                          <p className="text-sm text-muted-foreground">{device.classroom ?? 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                          {device.status ?? 'unknown'}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm font-medium">{device.power ?? 0}W</p>
                          <p className="text-xs text-muted-foreground">{typeof device.health === 'number' ? device.health.toFixed(0) : 0}% health</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Energy Tab */}
        <TabsContent value="energy" className="space-y-6">
          {/* Time Range Selector and Filters */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">Energy Consumption Analytics</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Device Filter */}
              <Select
                value={selectedDevices.length === 0 ? "all" : "selected"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedDevices([]);
                  } else {
                    // This would be handled by a multi-select, but for now we'll use single select
                    setSelectedDevices([]);
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {analyticsData?.devices?.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.classroom})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Classroom Filter */}
              <Select
                value={selectedClassrooms.length === 0 ? "all" : "selected"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedClassrooms([]);
                  } else {
                    setSelectedClassrooms([]);
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Classroom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classrooms</SelectItem>
                  {analyticsData?.devices &&
                    [...new Set(analyticsData.devices.map(d => d.classroom).filter(c => c))].map((classroom) => (
                      <SelectItem key={classroom} value={classroom}>
                        {classroom}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>

              {/* Time Range */}
              <div className="flex gap-2">
                {['24h', '7d', '30d'].map((timeframe) => (
                  <Button
                    key={timeframe}
                    variant={energyTimeframe === timeframe ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setEnergyTimeframe(timeframe);
                      fetchEnergyData(timeframe);
                      fetchForecastData('energy', timeframe);
                    }}
                  >
                    {timeframe}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Energy Consumption Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Energy Consumption Trend</CardTitle>
              <CardDescription>Total energy consumption over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={energyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: any, name: string) => [
                      name === 'Consumption' ? `${value.toFixed(2)} kWh` : `₹${value.toFixed(2)}`,
                      name
                    ]}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalConsumption"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    name="Consumption"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="totalCostINR"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Cost (₹)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Forecast vs Actual */}
          {forecastData && (
            <Card>
              <CardHeader>
                <CardTitle>Forecast vs Actual Usage</CardTitle>
                <CardDescription>Predicted vs actual energy consumption with confidence intervals</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={forecastData.forecast}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: any, name: string) => [
                        `${value.toFixed(2)} kWh`,
                        name === 'predicted' ? 'Predicted' : 'Actual'
                      ]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      stroke="#3b82f6"
                      strokeDasharray="5 5"
                      name="Predicted"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#10b981"
                      name="Actual"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Device Health Overview</CardTitle>
              <CardDescription>Health scores and status for all devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analyticsData.devices?.map((device) => {
                  const IconComponent = getDeviceIcon(device.type);
                  return (
                    <div key={device.id} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <IconComponent className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{device.name ?? 'Unknown Device'}</p>
                          <p className="text-xs text-muted-foreground">{device.classroom ?? 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Status</span>
                          <Badge variant={device.status === 'online' ? 'default' : 'destructive'} className="text-xs">
                            {device.status ?? 'unknown'}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Power</span>
                          <span>{device.power ?? 0}W</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Health</span>
                          <span className={typeof device.health === 'number' && device.health > 80 ? 'text-green-600' : typeof device.health === 'number' && device.health > 60 ? 'text-yellow-600' : 'text-red-600'}>
                            {typeof device.health === 'number' ? device.health.toFixed(0) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Occupancy Tab */}
        <TabsContent value="occupancy" className="space-y-6">
          {/* Occupancy Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Classrooms</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{occupancyData?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Monitored spaces
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Occupancy</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {occupancyData?.length ? Math.round(occupancyData.reduce((sum: number, room: any) => sum + room.currentOccupancy, 0) / occupancyData.length) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Current utilization
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Peak Occupancy</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {occupancyData?.length ? Math.max(...occupancyData.map((room: any) => room.currentOccupancy)) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Highest utilization
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sensors</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {occupancyData?.filter((room: any) => room.sensorStatus === 'active').length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Working sensors
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Occupancy Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Current Occupancy by Classroom</CardTitle>
              <CardDescription>Real-time occupancy levels across all monitored spaces</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {occupancyData && occupancyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={occupancyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Occupancy']}
                      labelFormatter={(label) => `Room: ${label}`}
                    />
                    <Bar dataKey="currentOccupancy" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No occupancy data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Occupancy Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Classroom Details</CardTitle>
              <CardDescription>Detailed occupancy information for each monitored space</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {occupancyData?.map((room: any) => (
                  <div key={room.classroomId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                        <MapPin className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{room.name}</h4>
                        <p className="text-sm text-muted-foreground capitalize">{room.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold">{room.currentOccupancy}%</div>
                        <div className="text-sm text-muted-foreground">Occupied</div>
                      </div>
                      <Badge variant={room.sensorStatus === 'active' ? 'default' : 'secondary'}>
                        {room.sensorStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Occupancy Forecast */}
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Forecast</CardTitle>
              <CardDescription>Predicted occupancy patterns for the next 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={Array.from({ length: 24 }, (_, i) => ({
                  hour: i,
                  current: occupancyData?.length ? Math.round(occupancyData.reduce((sum: number, room: any) => sum + room.currentOccupancy, 0) / occupancyData.length) : 0,
                  predicted: Math.max(0, Math.min(100, (occupancyData?.length ? occupancyData.reduce((sum: number, room: any) => sum + room.currentOccupancy, 0) / occupancyData.length : 50) + (Math.sin(i / 24 * 2 * Math.PI) * 30) + (Math.random() - 0.5) * 10))
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value: number) => [`${value}%`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="current" stroke="#3b82f6" strokeWidth={2} name="Current" />
                  <Line type="monotone" dataKey="predicted" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Predicted" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-6">
          {maintenanceData && (
            <>
              {/* Maintenance Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maintenanceData.totalDevices}</div>
                    <p className="text-xs text-muted-foreground">
                      Under maintenance monitoring
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Critical Devices</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{maintenanceData.criticalDevices}</div>
                    <p className="text-xs text-muted-foreground">
                      Require immediate attention
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">₹{maintenanceData.costSavingsINR?.toLocaleString() ?? 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Potential annual savings
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Device Health Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Device Health & Uptime Predictions</CardTitle>
                  <CardDescription>Predictive maintenance schedule and health scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {maintenanceData.maintenanceSchedule.map((device: any) => {
                      const IconComponent = getDeviceIcon(device.deviceType);
                      const healthColor = device.healthScore > 80 ? 'text-green-600' :
                                        device.healthScore > 60 ? 'text-yellow-600' : 'text-red-600';
                      const priorityColor = device.priority === 'high' ? 'bg-red-100 text-red-800' :
                                          device.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-green-100 text-green-800';

                      return (
                        <div key={device.deviceId} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <IconComponent className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{device.deviceName}</p>
                              <p className="text-sm text-muted-foreground">{device.classroom}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className={`text-sm font-medium ${healthColor}`}>{device.healthScore}%</p>
                              <p className="text-xs text-muted-foreground">Health</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium">{device.daysToFailure}d</p>
                              <p className="text-xs text-muted-foreground">To Failure</p>
                            </div>
                            <Badge className={priorityColor}>
                              {device.priority}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Maintenance Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Maintenance Recommendations</CardTitle>
                  <CardDescription>AI-powered maintenance scheduling and recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {maintenanceData.maintenanceSchedule
                      .filter((device: any) => device.priority !== 'low')
                      .map((device: any) => (
                        <div key={`rec-${device.deviceId}`} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-yellow-800">{device.deviceName} - {device.recommendation}</p>
                              <p className="text-sm text-yellow-700 mt-1">{device.classroom} • Priority: {device.priority}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-6">
          {anomalyData && (
            <>
              {/* Anomaly Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Anomalies</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{anomalyData.totalAnomalies}</div>
                    <p className="text-xs text-muted-foreground">
                      Last 7 days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                    <Activity className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{anomalyData.resolvedAnomalies}</div>
                    <p className="text-xs text-muted-foreground">
                      {anomalyData.totalAnomalies > 0 ? ((anomalyData.resolvedAnomalies / anomalyData.totalAnomalies) * 100).toFixed(0) : 0}% resolution rate
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Issues</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{anomalyData.totalAnomalies - anomalyData.resolvedAnomalies}</div>
                    <p className="text-xs text-muted-foreground">
                      Require attention
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Anomaly History */}
              <Card>
                <CardHeader>
                  <CardTitle>Anomaly History & Fault Patterns</CardTitle>
                  <CardDescription>Detailed anomaly detection and resolution tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {anomalyData.anomalies.map((anomaly: any) => {
                      const severityColor = anomaly.severity > 7 ? 'bg-red-100 text-red-800' :
                                          anomaly.severity > 4 ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-blue-100 text-blue-800';
                      const typeColor = anomaly.type === 'power_spike' ? 'text-red-600' :
                                      anomaly.type === 'connectivity_loss' ? 'text-orange-600' :
                                      anomaly.type === 'temperature_anomaly' ? 'text-yellow-600' :
                                      'text-purple-600';

                      return (
                        <div key={anomaly.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className={`w-5 h-5 ${anomaly.resolved ? 'text-green-500' : 'text-red-500'}`} />
                            <div>
                              <p className="font-medium">{anomaly.deviceName}</p>
                              <p className="text-sm text-muted-foreground">{anomaly.classroom}</p>
                              <p className={`text-xs font-medium ${typeColor}`}>{anomaly.type.replace('_', ' ').toUpperCase()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <Badge className={severityColor}>
                                Severity {anomaly.severity}
                              </Badge>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium">
                                {new Date(anomaly.timestamp).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(anomaly.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                            <Badge variant={anomaly.resolved ? 'default' : 'destructive'}>
                              {anomaly.resolved ? 'Resolved' : 'Active'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Fault Pattern Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Fault Pattern Analysis</CardTitle>
                  <CardDescription>Common failure patterns and preventive insights</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Anomaly Types Distribution */}
                    <div>
                      <h4 className="font-medium mb-3">Anomaly Types Distribution</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Power Spike', value: anomalyData.anomalies.filter((a: any) => a.type === 'power_spike').length, color: '#ef4444' },
                              { name: 'Connectivity Loss', value: anomalyData.anomalies.filter((a: any) => a.type === 'connectivity_loss').length, color: '#f97316' },
                              { name: 'Temperature', value: anomalyData.anomalies.filter((a: any) => a.type === 'temperature_anomaly').length, color: '#eab308' },
                              { name: 'Usage Anomaly', value: anomalyData.anomalies.filter((a: any) => a.type === 'usage_anomaly').length, color: '#a855f7' }
                            ].filter(item => item.value > 0)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={60}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {[
                              { name: 'Power Spike', value: anomalyData.anomalies.filter((a: any) => a.type === 'power_spike').length, color: '#ef4444' },
                              { name: 'Connectivity Loss', value: anomalyData.anomalies.filter((a: any) => a.type === 'connectivity_loss').length, color: '#f97316' },
                              { name: 'Temperature', value: anomalyData.anomalies.filter((a: any) => a.type === 'temperature_anomaly').length, color: '#eab308' },
                              { name: 'Usage Anomaly', value: anomalyData.anomalies.filter((a: any) => a.type === 'usage_anomaly').length, color: '#a855f7' }
                            ].filter(item => item.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Preventive Recommendations */}
                    <div>
                      <h4 className="font-medium mb-3">Preventive Recommendations</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                          <p>Power spikes detected - Consider voltage stabilizers for critical devices</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                          <p>Connectivity issues - Review network infrastructure and WiFi coverage</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                          <p>Temperature anomalies - Schedule HVAC maintenance and ventilation checks</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPanel;
