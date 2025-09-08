import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, Download, Filter, Search, AlertCircle, CheckCircle, XCircle, Info, Zap, Settings, Activity, Bug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const EnhancedLogsPage = () => {
  const [logs, setLogs] = useState({
    activities: [],
    errors: [],
    manualSwitches: [],
    deviceStatus: []
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('activities');
  const [filters, setFilters] = useState({
    search: '',
    startDate: '',
    endDate: '',
    deviceId: '',
    severity: '',
    errorType: '',
    resolved: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalPages: 1,
    totalCount: 0
  });
  const [stats, setStats] = useState(null);
  const [selectedError, setSelectedError] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const { toast } = useToast();

  // Fetch logs based on active tab and filters
  const fetchLogs = useCallback(async (resetPage = false) => {
    setLoading(true);
    try {
      const page = resetPage ? 1 : pagination.page;
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, value]) => value))
      });

      const response = await fetch(`/api/logs/${activeTab}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(prev => ({ ...prev, [activeTab]: data.logs }));
        setPagination(prev => ({
          ...prev,
          page,
          totalPages: data.pagination.totalPages,
          totalCount: data.pagination.totalCount
        }));
      } else {
        throw new Error('Failed to fetch logs');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, pagination.page, pagination.limit, toast]);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/logs/stats?timeframe=24h', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  // Export logs to Excel
  const exportToExcel = async () => {
    try {
      const response = await fetch('/api/logs/export/excel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          logType: activeTab,
          filters
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeTab}_logs_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: 'Success',
          description: 'Logs exported to Excel successfully'
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export logs',
        variant: 'destructive'
      });
    }
  };

  // Resolve error
  const resolveError = async (errorId) => {
    try {
      const response = await fetch(`/api/logs/errors/${errorId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: resolveNotes })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Error marked as resolved'
        });
        fetchLogs();
        setSelectedError(null);
        setResolveNotes('');
      } else {
        throw new Error('Failed to resolve error');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve error',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [activeTab, filters]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Update stats every minute
    return () => clearInterval(interval);
  }, [fetchStats]);

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (action) => {
    if (action.includes('manual')) return <Zap className="h-4 w-4" />;
    if (action.includes('error')) return <Bug className="h-4 w-4" />;
    if (action.includes('status')) return <Settings className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts.activities || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.counts.errors || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.counts.criticalErrors || 0} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manual Switches</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts.manualSwitches || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Checks</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts.statusChecks || 0}</div>
            <p className="text-xs text-muted-foreground">5-min intervals</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Export</Label>
              <Button onClick={exportToExcel} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Logs
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Error Logs
          </TabsTrigger>
          <TabsTrigger value="manual-switches" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Manual Switches
          </TabsTrigger>
          <TabsTrigger value="device-status" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Device Status
          </TabsTrigger>
        </TabsList>

        {/* Activity Logs Tab */}
        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>
                All device activities including manual switches and web commands
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs.activities.map((log) => (
                  <div key={log._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getActionIcon(log.action)}
                      <div>
                        <div className="font-medium">
                          {log.deviceName} - {log.switchName}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={log.action.includes('manual') ? 'secondary' : 'default'}>
                        {log.action}
                      </Badge>
                      <Badge variant="outline">
                        {log.triggeredBy}
                      </Badge>
                      {log.conflictResolution?.hasConflict && (
                        <Badge variant="destructive">
                          Conflict
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

                {logs.activities.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    No activity logs found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Logs Tab */}
        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Error Logs</CardTitle>
              <CardDescription>
                System errors, authentication failures, and device issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs.errors.map((error) => (
                  <div key={error._id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={getSeverityColor(error.severity)}>
                            {error.severity}
                          </Badge>
                          <Badge variant="outline">
                            {error.errorType}
                          </Badge>
                          {error.resolved ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Open
                            </Badge>
                          )}
                        </div>
                        <div className="font-medium mb-1">{error.message}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(error.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                          </span>
                          {error.deviceName && (
                            <span>Device: {error.deviceName}</span>
                          )}
                          {error.userName && (
                            <span>User: {error.userName}</span>
                          )}
                        </div>
                        {error.notes && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <strong>Resolution Notes:</strong> {error.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Info className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Error Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Error Type</Label>
                                <div className="font-medium">{error.errorType}</div>
                              </div>
                              <div>
                                <Label>Message</Label>
                                <div className="font-medium">{error.message}</div>
                              </div>
                              <div>
                                <Label>Details</Label>
                                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                                  {JSON.stringify(error.details, null, 2)}
                                </pre>
                              </div>
                              {error.stackTrace && (
                                <div>
                                  <Label>Stack Trace</Label>
                                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                                    {error.stackTrace}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        {!error.resolved && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" onClick={() => setSelectedError(error)}>
                                <CheckCircle className="mr-1 h-4 w-4" />
                                Resolve
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Resolve Error</DialogTitle>
                                <DialogDescription>
                                  Mark this error as resolved and add resolution notes.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="notes">Resolution Notes</Label>
                                  <Textarea
                                    id="notes"
                                    placeholder="Describe how this error was resolved..."
                                    value={resolveNotes}
                                    onChange={(e) => setResolveNotes(e.target.value)}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setSelectedError(null)}>
                                  Cancel
                                </Button>
                                <Button onClick={() => resolveError(error._id)}>
                                  Mark Resolved
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {logs.errors.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    No error logs found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Switches Tab */}
        <TabsContent value="manual-switches">
          <Card>
            <CardHeader>
              <CardTitle>Manual Switch Operations</CardTitle>
              <CardDescription>
                Physical switch operations detected by ESP32 devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs.manualSwitches.map((log) => (
                  <div key={log._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Zap className="h-5 w-5 text-yellow-600" />
                      <div>
                        <div className="font-medium">
                          {log.deviceName} - {log.switchName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {log.previousState} → {log.newState} • Pin {log.physicalPin}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">
                        {log.action}
                      </Badge>
                      <Badge variant="outline">
                        {log.detectedBy}
                      </Badge>
                      {(log.conflictWith.webCommand || log.conflictWith.scheduleCommand) && (
                        <Badge variant="destructive">
                          Conflict
                        </Badge>
                      )}
                      {log.responseTime && (
                        <Badge variant="outline">
                          {log.responseTime}ms
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

                {logs.manualSwitches.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    No manual switch logs found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Device Status Tab */}
        <TabsContent value="device-status">
          <Card>
            <CardHeader>
              <CardTitle>Device Status Monitoring</CardTitle>
              <CardDescription>
                Regular 5-minute status checks showing device health and switch states
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs.deviceStatus.map((log) => (
                  <div key={log._id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-medium">{log.deviceName}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Badge variant={log.deviceStatus?.isOnline ? 'default' : 'destructive'}>
                          {log.deviceStatus?.isOnline ? 'Online' : 'Offline'}
                        </Badge>
                        <Badge variant="outline">
                          {log.checkType}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Switches On</div>
                        <div className="font-medium">{log.summary?.totalSwitchesOn || 0}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Power Usage</div>
                        <div className="font-medium">{log.summary?.totalPowerConsumption || 0}W</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Response Time</div>
                        <div className="font-medium">{log.summary?.averageResponseTime || 0}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Issues</div>
                        <div className={`font-medium ${log.summary?.inconsistenciesFound > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {log.summary?.inconsistenciesFound || 0}
                        </div>
                      </div>
                    </div>

                    {log.alerts && log.alerts.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-sm font-medium text-muted-foreground mb-2">Alerts</div>
                        <div className="space-y-1">
                          {log.alerts.map((alert, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <AlertCircle className="h-4 w-4 text-red-500" />
                              <span className="text-sm">{alert.message}</span>
                              <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {logs.deviceStatus.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    No device status logs found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            disabled={pagination.page === 1}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </Button>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <span className="text-sm text-muted-foreground">
              ({pagination.totalCount} total)
            </span>
          </div>
          <Button
            variant="outline"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading logs...</p>
        </div>
      )}
    </div>
  );
};

export default EnhancedLogsPage;
