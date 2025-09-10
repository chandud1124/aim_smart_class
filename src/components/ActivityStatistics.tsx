import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  ZapOff, 
  User, 
  Calendar,
  Clock,
  Settings
} from 'lucide-react';
import { activityAPI } from '@/services/api';

interface ActivityStats {
  totalActivities: number;
  onActions: number;
  offActions: number;
  userTriggered: number;
  scheduleTriggered: number;
  pirTriggered: number;
  systemTriggered: number;
}

export const ActivityStatistics: React.FC = () => {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await activityAPI.getStats(period);
      setStats(response.data.data || {});
    } catch (err: any) {
      setError(err.message || 'Failed to fetch activity statistics');
      console.error('Error fetching activity stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case '24h': return 'Last 24 Hours';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      default: return 'Last 7 Days';
    }
  };

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Activity Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Activity className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading statistics...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Activity Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <Button onClick={fetchStats} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalActivities = stats?.totalActivities || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Activity Statistics
          </CardTitle>
          <CardDescription>
            System activity overview for {getPeriodLabel(period)}
          </CardDescription>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Activities */}
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">{totalActivities.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground">Total Activities</p>
        </div>

        {/* Action Types */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">ON Actions</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {stats?.onActions || 0}
                </Badge>
              </div>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground">
                  {getPercentage(stats?.onActions || 0, totalActivities)}% of total
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ZapOff className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium">OFF Actions</span>
                </div>
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  {stats?.offActions || 0}
                </Badge>
              </div>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground">
                  {getPercentage(stats?.offActions || 0, totalActivities)}% of total
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trigger Sources */}
        <div>
          <h4 className="text-sm font-medium mb-3">Trigger Sources</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm">User</span>
              </div>
              <Badge variant="outline">
                {stats?.userTriggered || 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span className="text-sm">Schedule</span>
              </div>
              <Badge variant="outline">
                {stats?.scheduleTriggered || 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="text-sm">PIR Sensor</span>
              </div>
              <Badge variant="outline">
                {stats?.pirTriggered || 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-600" />
                <span className="text-sm">System</span>
              </div>
              <Badge variant="outline">
                {stats?.systemTriggered || 0}
              </Badge>
            </div>
          </div>
        </div>

        {/* Activity Trend */}
        <div className="flex items-center justify-center pt-4 border-t">
          {totalActivities > 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Active period with {totalActivities} total activities</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm">No activities recorded in this period</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityStatistics;
