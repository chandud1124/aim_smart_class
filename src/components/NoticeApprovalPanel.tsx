import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  Image,
  Video,
  File,
  Calendar,
  Monitor,
  AlertCircle
} from 'lucide-react';
import { noticesAPI } from '@/services/api';
import { Notice, DisplayDevice } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface NoticeApprovalPanelProps {
  onNoticeUpdate?: () => void;
}

export const NoticeApprovalPanel: React.FC<NoticeApprovalPanelProps> = ({ onNoticeUpdate }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [devices, setDevices] = useState<DisplayDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [schedulingNotice, setSchedulingNotice] = useState<Notice | null>(null);
  const [scheduleData, setScheduleData] = useState({
    displayDevice: '',
    startTime: '',
    endTime: '',
    duration: 30,
    repeat: 'none' as 'none' | 'daily' | 'weekly' | 'monthly'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pendingRes, allRes, devicesRes] = await Promise.all([
        noticesAPI.getPendingNotices(),
        noticesAPI.getAllNotices(),
        noticesAPI.getDisplayDevices()
      ]);

      setNotices(pendingRes.data || []);
      setAllNotices(allRes.data?.notices || []);
      setDevices(devicesRes.data || []);
    } catch (error: any) {
      toast.error('Failed to load notices data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (noticeId: string) => {
    try {
      await noticesAPI.approveNotice(noticeId);
      toast.success('Notice approved successfully');
      loadData();
      onNoticeUpdate?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve notice');
    }
  };

  const handleReject = async () => {
    if (!selectedNotice || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      await noticesAPI.rejectNotice(selectedNotice._id, { reason: rejectionReason });
      toast.success('Notice rejected');
      setSelectedNotice(null);
      setRejectionReason('');
      loadData();
      onNoticeUpdate?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject notice');
    }
  };

  const handleSchedule = async () => {
    if (!schedulingNotice) return;

    try {
      await noticesAPI.scheduleNotice(schedulingNotice._id, {
        displayDevice: scheduleData.displayDevice,
        startTime: new Date(scheduleData.startTime),
        endTime: new Date(scheduleData.endTime),
        duration: scheduleData.duration,
        repeat: scheduleData.repeat === 'none' ? { type: 'none' } : {
          type: scheduleData.repeat,
          daysOfWeek: scheduleData.repeat === 'weekly' ? [1, 2, 3, 4, 5] : undefined // Mon-Fri by default
        }
      });

      toast.success('Notice scheduled successfully');
      setSchedulingNotice(null);
      setScheduleData({
        displayDevice: '',
        startTime: '',
        endTime: '',
        duration: 30,
        repeat: 'none'
      });
      loadData();
      onNoticeUpdate?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to schedule notice');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'scheduled':
        return <Badge variant="outline"><Calendar className="w-3 h-3 mr-1" />Scheduled</Badge>;
      case 'active':
        return <Badge variant="default"><Eye className="w-3 h-3 mr-1" />Active</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-gray-500',
      medium: 'bg-blue-500',
      high: 'bg-orange-500',
      urgent: 'bg-red-500'
    };
    return <Badge className={`${colors[priority as keyof typeof colors]} text-white`}>{priority}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'pdf': return <File className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading notices...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">
            Pending Approval ({notices.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Notices ({allNotices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {notices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">All caught up!</h3>
                <p className="text-muted-foreground">No notices pending approval.</p>
              </CardContent>
            </Card>
          ) : (
            notices.map((notice) => (
              <Card key={notice._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(notice.type)}
                      <CardTitle className="text-lg">{notice.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(notice.priority)}
                      {getStatusBadge(notice.status)}
                    </div>
                  </div>
                  <CardDescription>
                    Submitted by {notice.submittedBy.name} on {format(new Date(notice.createdAt), 'PPP')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {notice.content && (
                    <p className="text-sm text-muted-foreground mb-4">{notice.content}</p>
                  )}

                  {notice.mediaUrl && (
                    <div className="mb-4">
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {getTypeIcon(notice.type)}
                        Media attached
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    {notice.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">{tag}</Badge>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(notice._id)}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          onClick={() => setSelectedNotice(notice)}
                          className="flex items-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reject Notice</DialogTitle>
                          <DialogDescription>
                            Provide a reason for rejecting "{notice.title}"
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="rejection-reason">Rejection Reason</Label>
                            <Textarea
                              id="rejection-reason"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Please explain why this notice is being rejected..."
                              rows={3}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setSelectedNotice(null)}>
                              Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleReject}>
                              Reject Notice
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {allNotices.map((notice) => (
            <Card key={notice._id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(notice.type)}
                    <CardTitle className="text-lg">{notice.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(notice.priority)}
                    {getStatusBadge(notice.status)}
                  </div>
                </div>
                <CardDescription>
                  Submitted by {notice.submittedBy.name} • {format(new Date(notice.createdAt), 'PPP')}
                  {notice.approvedBy && ` • Approved by ${notice.approvedBy.name}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {notice.content && (
                  <p className="text-sm text-muted-foreground mb-4">{notice.content}</p>
                )}

                {notice.rejectionReason && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center gap-2 text-red-800 mb-1">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">Rejection Reason</span>
                    </div>
                    <p className="text-red-700 text-sm">{notice.rejectionReason}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {notice.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">{tag}</Badge>
                    ))}
                  </div>

                  {notice.status === 'approved' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => setSchedulingNotice(notice)}
                          className="flex items-center gap-2"
                        >
                          <Monitor className="w-4 h-4" />
                          Schedule Display
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Schedule Notice Display</DialogTitle>
                          <DialogDescription>
                            Schedule "{notice.title}" for display on devices
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="device">Display Device</Label>
                            <Select
                              value={scheduleData.displayDevice}
                              onValueChange={(value) => setScheduleData(prev => ({ ...prev, displayDevice: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a device" />
                              </SelectTrigger>
                              <SelectContent>
                                {devices.map((device) => (
                                  <SelectItem key={device._id} value={device._id}>
                                    {device.name} ({device.location})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="start-time">Start Time</Label>
                              <Input
                                id="start-time"
                                type="datetime-local"
                                value={scheduleData.startTime}
                                onChange={(e) => setScheduleData(prev => ({ ...prev, startTime: e.target.value }))}
                              />
                            </div>
                            <div>
                              <Label htmlFor="end-time">End Time</Label>
                              <Input
                                id="end-time"
                                type="datetime-local"
                                value={scheduleData.endTime}
                                onChange={(e) => setScheduleData(prev => ({ ...prev, endTime: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="duration">Duration (minutes)</Label>
                            <Input
                              id="duration"
                              type="number"
                              value={scheduleData.duration}
                              onChange={(e) => setScheduleData(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
                              min={1}
                              max={480}
                            />
                          </div>

                          <div>
                            <Label htmlFor="repeat">Repeat</Label>
                            <Select
                              value={scheduleData.repeat}
                              onValueChange={(value: 'none' | 'daily' | 'weekly' | 'monthly') =>
                                setScheduleData(prev => ({ ...prev, repeat: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Repeat</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setSchedulingNotice(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleSchedule}>
                              Schedule Notice
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};