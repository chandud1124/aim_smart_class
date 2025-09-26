import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { 
  Activity, 
  AlertTriangle, 
  Settings, 
  Monitor,
  Download,
  Calendar as CalendarIcon,
  Filter,
  RefreshCw,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Zap
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import api from '@/services/api';
import { ActivityLog } from '@/types';


// Safe property access helper
function safe<T = unknown, D = null>(obj: T, path: string, defaultValue: D = null as D): any {
  try {
    return path.split('.').reduce((current: any, key) => current?.[key], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

interface LocalActivityLog {
  id: string;
  timestamp: string | number | Date;
  action: string;
  deviceId?: string;
  deviceName?: string;
  switchId?: string;
  switchName?: string;
  userId?: string;
  userName?: string;
  triggeredBy: string;
  location?: string;
  isManualOverride?: boolean;
  previousState?: boolean;
  newState?: boolean;
  conflictResolution?: {
    hasConflict: boolean;
    conflictType?: string;
    resolution?: string;
    responseTime?: number;
  } | string;
  details?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

interface ManualSwitchLog {
  id: string;
  timestamp: string | number | Date;
  deviceId: string;
  deviceName?: string;
  switchId: string;
  switchName?: string;
  action: 'manual_on' | 'manual_off' | 'manual_toggle';
  previousState: 'on' | 'off' | 'unknown';
  newState: 'on' | 'off';
  conflictWith?: {
    webCommand?: boolean;
    scheduleCommand?: boolean;
    pirCommand?: boolean;
  };
  responseTime?: number;
  location?: string;
  details?: any;
}

interface DeviceStatusLog {
  id: string;
  timestamp: string | number | Date;
  deviceId: string;
  deviceName?: string;
  deviceMac?: string;
  checkType: string;
  deviceStatus: {
    isOnline: boolean;
    wifiSignalStrength?: number;
    uptime?: number;
    freeHeap?: number;
    temperature?: number;
    lastSeen?: Date;
    responseTime?: number;
    powerStatus?: string;
  };
  switchStates?: Record<string, unknown>[];
  alerts?: Record<string, unknown>[];
  summary?: {
    totalSwitchesOn?: number;
    totalSwitchesOff?: number;
    totalPowerConsumption?: number;
    averageResponseTime?: number;
    inconsistenciesFound?: number;
  };
  location?: string;
}

interface LogStats {
  activities: { total: number; today: number };
  manualSwitches: { total: number; today: number; conflicts: number };
  deviceStatus: { total: number; today: number };
}

type LogType = 'activities' | 'manual-switches' | 'device-status';

  // Safe rendering of statistics cards
  const renderStatsCard = (title: string, icon: React.ReactNode, value: number, subtitle: string) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value || 0}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );

  const ActiveLogsPage = () => {
  const [activeTab, setActiveTab] = useState<LogType>('activities');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [stats, setStats] = useState<LogStats | null>(null);
  
  // Data states
  // State for different log types
  const [activityLogs, setActivityLogs] = useState<LocalActivityLog[]>([]);
  const [manualSwitchLogs, setManualSwitchLogs] = useState<ManualSwitchLog[]>([]);
  const [deviceStatusLogs, setDeviceStatusLogs] = useState<DeviceStatusLog[]>([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCalendar, setShowCalendar] = useState(false);

  // Device list state
  const [devices, setDevices] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Error resolution dialog - removed
  // const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  // const [resolutionText, setResolutionText] = useState('');

  useEffect(() => {
    loadData();
    loadStats();
  }, [activeTab]);

  useEffect(() => {
    const delayedLoad = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(delayedLoad);
  }, [searchTerm, deviceFilter, severityFilter, statusFilter, dateRange, currentPage]);

  // Fetch devices on component mount
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setIsLoadingDevices(true);
    try {
      const response = await api.get('/device-categories/categories?showAllDevices=true');
      if (response.data.success && response.data.allDevices) {
        setDevices(response.data.allDevices);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      setDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      let endpoint = '';
      switch (activeTab) {
        case 'activities':
          endpoint = '/logs/activities';
          break;
        case 'manual-switches':
          endpoint = '/logs/manual-switches';
          break;
        case 'device-status':
          endpoint = '/logs/device-status';
          break;
      }

      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (deviceFilter !== 'all') params.set('deviceId', deviceFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (statusFilter !== 'all') params.set('resolved', statusFilter === 'resolved' ? 'true' : 'false');
      if (dateRange.from) params.set('startDate', dateRange.from.toISOString());
      if (dateRange.to) params.set('endDate', dateRange.to.toISOString());
      params.set('page', currentPage.toString());
      params.set('limit', itemsPerPage.toString());

      const response = await api.get(`${endpoint}?${params.toString()}`);
      const data = response.data.logs || response.data.data || response.data;

      switch (activeTab) {
        case 'activities':
          setActivityLogs(Array.isArray(data) ? data : []);
          break;
        case 'manual-switches':
          setManualSwitchLogs(Array.isArray(data) ? data : []);
          break;
        case 'device-status':
          setDeviceStatusLogs(Array.isArray(data) ? data : []);
          break;
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/logs/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
      // Set default stats structure to prevent undefined errors
      setStats({
        activities: { total: 0, today: 0 },
        manualSwitches: { total: 0, today: 0, conflicts: 0 },
        deviceStatus: { total: 0, today: 0 }
      });
    }
  };

  const exportToExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    
    try {
      const params = new URLSearchParams();
      params.set('type', activeTab);
      // Export ALL reports - remove filters to get complete dataset
      // if (searchTerm) params.set('search', searchTerm);
      // if (deviceFilter !== 'all') params.set('deviceId', deviceFilter);
      // if (severityFilter !== 'all') params.set('severity', severityFilter);
      // if (statusFilter !== 'all') params.set('status', statusFilter);
      // if (dateRange.from) params.set('startDate', dateRange.from.toISOString());
      // if (dateRange.to) params.set('endDate', dateRange.to.toISOString());

      const response = await api.post(`/logs/export/excel?${params.toString()}`, {}, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeTab}-logs-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting logs:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Error resolution function removed
  // const resolveError = async (errorId: string, resolution: string) => {
  //   try {
  //     await api.patch(`/logs/errors/${errorId}/resolve`, { notes: resolution });
  //     setSelectedError(null);
  //     setResolutionText('');
  //     loadData();
  //   } catch (error) {
  //     console.error('Error resolving error:', error);
  //   }
  // };

  const clearFilters = () => {
    setSearchTerm('');
    setDateRange({});
    setDeviceFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const getTabIcon = (tab: LogType) => {
    switch (tab) {
      case 'activities': return <Activity className="w-4 h-4" />;
      case 'manual-switches': return <Zap className="w-4 h-4" />;
      case 'device-status': return <Monitor className="w-4 h-4" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
      critical: 'bg-red-600 text-white'
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (resolved: boolean) => {
    return resolved 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  const filteredData = useMemo(() => {
  let data: LocalActivityLog[] | ManualSwitchLog[] | DeviceStatusLog[] = [];
    switch (activeTab) {
      case 'activities': data = activityLogs; break;
      case 'manual-switches': data = manualSwitchLogs; break;
      case 'device-status': data = deviceStatusLogs; break;
    }
    return data;
  }, [activeTab, activityLogs, manualSwitchLogs, deviceStatusLogs]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  return (
    <div className="w-full max-w-7xl mx-auto mt-4 space-y-6">
      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Activity Logs</p>
                  <p className="text-2xl font-bold">{safe(stats, 'activities.total', 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    {safe(stats, 'activities.today', 0)} today
                  </p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Manual Switches</p>
                  <p className="text-2xl font-bold">{safe(stats, 'manualSwitches.total', 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    {safe(stats, 'manualSwitches.conflicts', 0)} conflicts
                  </p>
                </div>
                <Zap className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Device Status</p>
                  <p className="text-2xl font-bold">{safe(stats, 'deviceStatus.total', 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    {safe(stats, 'deviceStatus.today', 0)} today
                  </p>
                </div>
                <Monitor className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Enhanced Logs
            </CardTitle>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                disabled={isExporting}
              >
                <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-spin' : ''}`} />
                Export All Excel
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="lg:col-span-2"
              />

              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      "Date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange.from ? dateRange as { from: Date; to?: Date } : undefined}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="min-w-[200px] w-full">
                  <SelectValue placeholder="Select Device" />
                </SelectTrigger>
                <SelectContent className="min-w-[200px]">
                  <SelectItem value="all">All Devices</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id} className="py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-medium text-sm truncate">{device.name}</span>
                        <Badge
                          variant={device.status === 'online' ? 'default' : 'secondary'}
                          className="text-xs px-2 py-0.5 flex-shrink-0"
                        >
                          {device.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabbed Interface */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LogType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="activities" className="flex items-center gap-2">
                {getTabIcon('activities')}
                <span className="hidden md:inline">Activity Logs</span>
                <span className="md:hidden">Activity</span>
              </TabsTrigger>
              <TabsTrigger value="manual-switches" className="flex items-center gap-2">
                {getTabIcon('manual-switches')}
                <span className="hidden md:inline">Manual Switches</span>
                <span className="md:hidden">Manual</span>
              </TabsTrigger>
              <TabsTrigger value="device-status" className="flex items-center gap-2">
                {getTabIcon('device-status')}
                <span className="hidden md:inline">Device Status</span>
                <span className="md:hidden">Status</span>
              </TabsTrigger>
            </TabsList>

            {/* Activity Logs */}
            <TabsContent value="activities">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="animate-spin w-6 h-6 mr-2" />
                    Loading activity logs...
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No activity logs found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left">Time</th>
                          <th className="px-4 py-2 text-left">Action</th>
                          <th className="px-4 py-2 text-left">Device/Switch</th>
                          <th className="px-4 py-2 text-left">User/Source</th>
                          <th className="px-4 py-2 text-left">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paginatedData as ActivityLog[]).map((log) => (
                          <tr key={log.id} className="border-b hover:bg-muted/50">
                            <td className="px-4 py-2 whitespace-nowrap">
                              {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant={(log.action || 'unknown') === 'on' ? 'default' : 'secondary'}>
                                {log.action || 'unknown'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2">
                              <div>
                                <div className="font-medium">{log.deviceName || '-'}</div>
                                {log.switchName && (
                                  <div className="text-xs text-muted-foreground">{log.switchName}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div>
                                {log.userName && (
                                  <div className="font-medium">{log.userName}</div>
                                )}
                                <div className="text-xs">
                                  <Badge variant="outline" className="text-xs">
                                    {log.triggeredBy || 'unknown'}
                                  </Badge>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {log.location || log.facility || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Manual Switch Logs */}
            <TabsContent value="manual-switches">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="animate-spin w-6 h-6 mr-2" />
                    Loading manual switch logs...
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No manual switch logs found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left">Time</th>
                          <th className="px-4 py-2 text-left">Device/Switch</th>
                          <th className="px-4 py-2 text-left">Action</th>
                          <th className="px-4 py-2 text-left">Response Time</th>
                          <th className="px-4 py-2 text-left">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paginatedData as ManualSwitchLog[]).map((log) => (
                          <tr key={log.id} className="border-b hover:bg-muted/50">
                            <td className="px-4 py-2 whitespace-nowrap">
                              {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                            </td>
                            <td className="px-4 py-2">
                              <div>
                                <div className="font-medium">{log.deviceName || '-'}</div>
                                {log.switchName && (
                                  <div className="text-xs text-muted-foreground">{log.switchName}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant="outline" className="text-xs">
                                {(log.action || 'unknown').replace('manual_', '').toUpperCase()}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {log.responseTime ? `${log.responseTime}ms` : '-'}
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {log.location || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Device Status Logs */}
            <TabsContent value="device-status">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="animate-spin w-6 h-6 mr-2" />
                    Loading device status logs...
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No device status logs found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left">Time</th>
                          <th className="px-4 py-2 text-left">Device</th>
                          <th className="px-4 py-2 text-left">Online Status</th>
                          <th className="px-4 py-2 text-left">Signal/Temp</th>
                          <th className="px-4 py-2 text-left">Switches</th>
                          <th className="px-4 py-2 text-left">Alerts</th>
                          <th className="px-4 py-2 text-left">Response Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paginatedData as DeviceStatusLog[]).map((log) => (
                          <tr key={log.id} className="border-b hover:bg-muted/50">
                            <td className="px-4 py-2 whitespace-nowrap">
                              {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                            </td>
                            <td className="px-4 py-2">
                              <div>
                                <div className="font-medium">{log.deviceName || '-'}</div>
                                {log.deviceMac && (
                                  <div className="text-xs text-muted-foreground">{log.deviceMac}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant={safe(log, 'deviceStatus.isOnline', false) ? 'default' : 'destructive'}>
                                {safe(log, 'deviceStatus.isOnline', false) ? (
                                  <>🟢 Online</>
                                ) : (
                                  <>🔴 Offline</>
                                )}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-xs">
                              <div>
                                {safe(log, 'deviceStatus.wifiSignalStrength') && (
                                  <div>Signal: {safe(log, 'deviceStatus.wifiSignalStrength')}dBm</div>
                                )}
                                {safe(log, 'deviceStatus.temperature') && (
                                  <div>Temp: {safe(log, 'deviceStatus.temperature')}°C</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {log.summary && (
                                <div>
                                  <div>On: {safe(log, 'summary.totalSwitchesOn', 0)}</div>
                                  <div>Off: {safe(log, 'summary.totalSwitchesOff', 0)}</div>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {log.alerts && log.alerts.length > 0 ? (
                                <Badge variant="destructive">
                                  {log.alerts.length} Alert{log.alerts.length > 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <Badge variant="default">No Alerts</Badge>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {safe(log, 'deviceStatus.responseTime') ? `${safe(log, 'deviceStatus.responseTime')}ms` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pageNum = currentPage - 2 + i;
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActiveLogsPage;
