import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import { Notice, NoticeReviewData } from '@/types';

interface NoticeApprovalPanelProps {
  notices: Notice[];
  onRefresh: () => void;
}

const NoticeApprovalPanel: React.FC<NoticeApprovalPanelProps> = ({ notices, onRefresh }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    notice: Notice | null;
    action: 'approve' | 'reject' | null;
  }>({
    open: false,
    notice: null,
    action: null
  });
  const [rejectionReason, setRejectionReason] = useState('');

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

  const handleReview = async (noticeId: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectionReason.trim()) {
      toast({
        title: 'Rejection reason required',
        description: 'Please provide a reason for rejection.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(noticeId);

    try {
      const reviewData: NoticeReviewData = {
        action,
        ...(action === 'reject' && { rejectionReason })
      };

      const response = await api.patch(`/notices/${noticeId}/review`, reviewData);

      if (response.data.success) {
        toast({
          title: `Notice ${action}d successfully`,
          description: action === 'approve'
            ? 'The notice has been published.'
            : 'The notice has been rejected and the submitter has been notified.'
        });
        setReviewDialog({ open: false, notice: null, action: null });
        setRejectionReason('');
        onRefresh();
      }
    } catch (err: any) {
      toast({
        title: 'Review failed',
        description: err.response?.data?.message || 'Failed to review notice',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const openReviewDialog = (notice: Notice, action: 'approve' | 'reject') => {
    setReviewDialog({ open: true, notice, action });
    setRejectionReason('');
  };

  if (notices.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">No pending notices for approval</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Review pending notices. Approved notices will be moved to the "Approved" tab where they can be published to make them active.
            Rejected notices will be returned to the submitter with feedback.
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
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>By: {notice.submittedBy.name}</p>
                    <p>{formatDate(notice.createdAt)}</p>
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

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => openReviewDialog(notice, 'approve')}
                      disabled={loading === notice._id}
                      className="flex-1"
                    >
                      {loading === notice._id && reviewDialog.action === 'approve' && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => openReviewDialog(notice, 'reject')}
                      disabled={loading === notice._id}
                      variant="destructive"
                      className="flex-1"
                    >
                      {loading === notice._id && reviewDialog.action === 'reject' && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => setReviewDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === 'approve' ? 'Approve Notice' : 'Reject Notice'}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === 'approve'
                ? 'Review the notice details and confirm approval. Approved notices can be published later to make them active.'
                : 'Review the notice details and provide a reason for rejection.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {reviewDialog.action === 'approve'
                ? 'Are you sure you want to approve this notice? It will be moved to the Approved tab for publishing.'
                : 'Please provide a reason for rejecting this notice.'
              }
            </p>

            {reviewDialog.notice && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium">{reviewDialog.notice.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Submitted by: {reviewDialog.notice.submittedBy.name}
                </p>
              </div>
            )}

            {reviewDialog.action === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please explain why this notice is being rejected..."
                  rows={3}
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewDialog({ open: false, notice: null, action: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => reviewDialog.notice && handleReview(reviewDialog.notice._id, reviewDialog.action!)}
              disabled={loading !== null || (reviewDialog.action === 'reject' && !rejectionReason.trim())}
              variant={reviewDialog.action === 'reject' ? 'destructive' : 'default'}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {reviewDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export { NoticeApprovalPanel };
