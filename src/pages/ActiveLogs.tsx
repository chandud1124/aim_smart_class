import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/api';

interface ActivityLog {
  _id: string;
  timestamp: string | number | Date;
  action?: 'on' | 'off' | 'toggle' | 'device_created' | 'device_updated' | 'device_deleted' | 'bulk_on' | 'bulk_off' | string;
  deviceName?: string;
  switchName?: string;
  userName?: string;
  triggeredBy?: 'user' | 'schedule' | 'pir' | 'master' | 'system' | string;
  location?: string;
  classroom?: string;
}

const ALL = 'all' as const;

type DateFilter = typeof ALL | 'today' | 'yesterday' | 'week' | 'month';

type ActionFilter = typeof ALL | NonNullable<ActivityLog['action']>;

type SourceFilter = typeof ALL | NonNullable<ActivityLog['triggeredBy']>;

const ActiveLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin] = useState(true); // TODO: replace with actual admin check if needed

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>(ALL);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(ALL);
  const [userFilter, setUserFilter] = useState<string | typeof ALL>(ALL);
  const [dateFilter, setDateFilter] = useState<DateFilter>(ALL);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/activity-logs');
        const data = res.data;
        if (!cancelled) {
          // controller returns a plain array
          setLogs(Array.isArray(data) ? data : (data?.data ?? []));
        }
      } catch (e) {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const uniqueUsers = useMemo(() => {
    return Array.from(new Set(logs.map(l => (l.userName || '').trim()).filter(Boolean)));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let data = logs.slice();

    // Text search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      data = data.filter(l => (
        (l.deviceName && l.deviceName.toLowerCase().includes(q)) ||
        (l.switchName && l.switchName.toLowerCase().includes(q)) ||
        (l.action && String(l.action).toLowerCase().includes(q)) ||
        (l.userName && l.userName.toLowerCase().includes(q)) ||
        (l.triggeredBy && String(l.triggeredBy).toLowerCase().includes(q)) ||
        (l.location && l.location.toLowerCase().includes(q)) ||
        (l.classroom && l.classroom.toLowerCase().includes(q))
      ));
    }

    // Action filter
    if (actionFilter !== ALL) {
      data = data.filter(l => l.action === actionFilter);
    }

    // Source filter (triggeredBy)
    if (sourceFilter !== ALL) {
      data = data.filter(l => l.triggeredBy === sourceFilter);
    }

    // User filter (userName)
    if (userFilter !== ALL) {
      data = data.filter(l => (l.userName || '') === userFilter);
    }

    // Date filter
    if (dateFilter !== ALL) {
      const now = new Date();
      const start = new Date();
      let end: Date | null = null;
      switch (dateFilter) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setHours(23, 59, 59, 999);
          break;
        case 'week':
          start.setDate(start.getDate() - 7);
          break;
        case 'month':
          start.setMonth(start.getMonth() - 1);
          break;
      }
      data = data.filter(l => {
        const t = new Date(l.timestamp).getTime();
        const afterStart = t >= start.getTime();
        const beforeEnd = end ? t <= end.getTime() : true;
        return afterStart && beforeEnd;
      });
    }

    return data;
  }, [logs, searchTerm, actionFilter, sourceFilter, userFilter, dateFilter]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" />
      </div>
    );
  }

  // Color maps for actions and sources
  const actionColors: Record<string, string> = {
    on: 'bg-green-500 text-white',
    off: 'bg-red-500 text-white',
    toggle: 'bg-yellow-500 text-black',
    bulk_on: 'bg-green-700 text-white',
    bulk_off: 'bg-red-700 text-white',
    device_created: 'bg-blue-500 text-white',
    device_updated: 'bg-blue-300 text-black',
    device_deleted: 'bg-gray-500 text-white',
  };
  const sourceColors: Record<string, string> = {
    user: 'bg-purple-500 text-white',
    schedule: 'bg-teal-500 text-white',
    pir: 'bg-orange-500 text-white',
    master: 'bg-pink-500 text-white',
    system: 'bg-gray-400 text-black',
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-4 space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ActionFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Actions</SelectItem>
                <SelectItem value="on">On</SelectItem>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="toggle">Toggle</SelectItem>
                <SelectItem value="bulk_on">Bulk On</SelectItem>
                <SelectItem value="bulk_off">Bulk Off</SelectItem>
                <SelectItem value="device_created">Device Created</SelectItem>
                <SelectItem value="device_updated">Device Updated</SelectItem>
                <SelectItem value="device_deleted">Device Deleted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Sources</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="schedule">Schedule</SelectItem>
                <SelectItem value="pir">PIR</SelectItem>
                <SelectItem value="master">Master</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={(v) => setUserFilter(v)}>
              <SelectTrigger>
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Users</SelectItem>
                {uniqueUsers.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">Showing {filteredLogs.length} of {logs.length} logs</div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="animate-spin w-6 h-6 mr-2">⏳</span> Loading logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-muted-foreground">No activity logs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left">Time</th>
                    <th className="px-2 py-1 text-left">Action</th>
                    <th className="px-2 py-1 text-left">Device</th>
                    <th className="px-2 py-1 text-left">Switch</th>
                    <th className="px-2 py-1 text-left">User/Source</th>
                    <th className="px-2 py-1 text-left">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    // Color for action badge
                    const actionClass = log.action && actionColors[log.action] ? actionColors[log.action] : 'bg-gray-200 text-black';
                    // Color for source badge
                    const sourceClass = log.triggeredBy && sourceColors[log.triggeredBy] ? sourceColors[log.triggeredBy] : 'bg-gray-100 text-black';
                    // No row highlight; only badges are colored
                    const rowClass = '';
                    return (
                      <tr key={log._id} className={`border-b last:border-b-0 ${rowClass}`}>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-2 py-1">
                          <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${actionClass}`}>
                            {log.action || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1">{log.deviceName || '-'}</td>
                        <td className="px-2 py-1">{log.switchName || '-'}</td>
                        <td className="px-2 py-1">
                          {log.userName ? (
                            <span className="inline-block rounded px-2 py-1 text-xs font-semibold bg-purple-600 text-white">
                              {log.userName}
                            </span>
                          ) : log.triggeredBy === 'schedule' ? (
                            <span className="inline-block rounded px-2 py-1 text-xs font-semibold bg-teal-600 text-white">
                              schedule
                            </span>
                          ) : log.triggeredBy ? (
                            <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${sourceClass}`}>
                              {log.triggeredBy}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-2 py-1">{log.location || log.classroom || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActiveLogs;
