import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, Eye, AlertTriangle, Send, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import { Notice } from '@/types';
import ContentAssignment from './ContentAssignment';

interface NoticePublishingPanelProps {
  notices: Notice[];
  onRefresh: () => void;
}

const NoticePublishingPanel: React.FC<NoticePublishingPanelProps> = ({ notices, onRefresh }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [showAssignment, setShowAssignment] = useState<Record<string, boolean>>({});

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePublish = async (noticeId: string) => {
    setLoading(noticeId);

    try {
      const response = await api.patch(`/notices/${noticeId}/publish`);

      if (response.data.success) {
        toast({
          title: 'Notice published successfully',
          description: 'The notice is now active and visible to users.'
        });
        onRefresh();
      }
    } catch (err: any) {
      toast({
        title: 'Publish failed',
        description: err.response?.data?.message || 'Failed to publish notice',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const toggleAssignment = (noticeId: string) => {
    setShowAssignment(prev => ({
      ...prev,
      [noticeId]: !prev[noticeId]
    }));
  };

  if (notices.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">No approved notices waiting to be published</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          These notices have been approved and are ready to be published. You can assign them to specific display boards before publishing.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {notices.map((notice) => (
          <Card key={notice._id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <CardTitle className="text-xl">{notice.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(notice.priority)}>
                      {notice.priority.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">{notice.category}</Badge>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approved
                    </Badge>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>By: {notice.submittedBy.name}</p>
                  <p>Approved: {notice.approvedAt ? formatDate(notice.approvedAt) : 'N/A'}</p>
                  {notice.expiryDate && (
                    <p className="text-orange-600">
                      Expires: {formatDate(notice.expiryDate)}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{notice.content}</p>
                </div>

                {notice.attachments && notice.attachments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Attachments:</h4>
                    <div className="flex flex-wrap gap-2">
                      {notice.attachments.map((attachment, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(attachment.url, '_blank')}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {attachment.originalName}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Assignment Section */}
                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAssignment(notice._id)}
                    className="mb-3"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    {showAssignment[notice._id] ? 'Hide' : 'Show'} Board Assignment
                  </Button>

                  {showAssignment[notice._id] && (
                    <ContentAssignment
                      notice={notice}
                      onAssignmentChange={onRefresh}
                    />
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => handlePublish(notice._id)}
                    disabled={loading === notice._id}
                    className="flex-1"
                  >
                    {loading === notice._id && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    <Send className="h-4 w-4 mr-2" />
                    Publish Notice
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export { NoticePublishingPanel };