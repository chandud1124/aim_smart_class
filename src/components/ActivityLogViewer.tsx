import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function ActivityLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/activity-logs?limit=50')
      .then(res => res.json())
      .then(data => {
        setLogs(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load logs');
        setLoading(false);
      });
  }, []);

  return (
    <Card className="w-full max-w-3xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Activity Logs</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin w-6 h-6 mr-2" /> Loading logs...
          </div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : logs.length === 0 ? (
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
                  <th className="px-2 py-1 text-left">User</th>
                  <th className="px-2 py-1 text-left">Location</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log._id} className="border-b last:border-b-0">
                    <td className="px-2 py-1 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-2 py-1"><Badge>{log.action}</Badge></td>
                    <td className="px-2 py-1">{log.deviceName || '-'}</td>
                    <td className="px-2 py-1">{log.switchName || '-'}</td>
                    <td className="px-2 py-1">{log.userName || log.triggeredBy || '-'}</td>
                    <td className="px-2 py-1">{log.location || log.classroom || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
