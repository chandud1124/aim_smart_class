import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Eye, Clock, CheckCircle, XCircle, AlertTriangle, Monitor } from 'lucide-react';
import { NoticeSubmissionForm } from '@/components/NoticeSubmissionForm';
import { NoticeApprovalPanel } from '@/components/NoticeApprovalPanel';
import { NoticePublishingPanel } from '@/components/NoticePublishingPanel';
import BoardManager from '@/components/BoardManager';
import ContentScheduler from '@/components/ContentScheduler';
import { useAuth } from '@/hooks/useAuth';
import { Notice, NoticeFilters } from '@/types';
import api from '@/services/api';

const NoticeBoard: React.FC = () => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [activeNotices, setActiveNotices] = useState<Notice[]>([]);
  const [pendingNotices, setPendingNotices] = useState<Notice[]>([]);
  const [approvedNotices, setApprovedNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [filters, setFilters] = useState<NoticeFilters>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Fetch notices based on user role
  const fetchNotices = async () => {
    try {
      setLoading(true);
      setError(null);

      const [noticesResponse, activeResponse] = await Promise.all([
        api.get('/notices', { params: filters }),
        api.get('/notices/active')
      ]);

      if (noticesResponse.data.success) {
        setNotices(noticesResponse.data.notices);
      }

      if (activeResponse.data.success) {
        setActiveNotices(activeResponse.data.notices);
      }

      // Fetch pending notices for admin users
      if (user?.role === 'admin' || user?.role === 'super-admin') {
        const [pendingResponse, approvedResponse] = await Promise.all([
          api.get('/notices/pending'),
          api.get('/notices', { params: { status: 'approved' } })
        ]);
        if (pendingResponse.data.success) {
          setPendingNotices(pendingResponse.data.notices);
        }
        if (approvedResponse.data.success) {
          setApprovedNotices(approvedResponse.data.notices);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [filters, user]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'default';
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published': return <CheckCircle className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notice Board</h1>
          <p className="text-muted-foreground">
            View and manage notices for the institution
          </p>
        </div>
        <Button onClick={() => setShowSubmissionForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Submit Notice
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Notices</TabsTrigger>
          <TabsTrigger value="all">All Notices</TabsTrigger>
          {(user?.role === 'admin' || user?.role === 'super-admin') && (
            <>
              <TabsTrigger value="board-management">Board Management</TabsTrigger>
              <TabsTrigger value="content-scheduler">Content Scheduler</TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({approvedNotices.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending Approval ({pendingNotices.length})
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeNotices.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">No active notices at the moment</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeNotices.map((notice) => (
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
                          <Badge variant={getStatusColor(notice.status)}>
                            {getStatusIcon(notice.status)}
                            <span className="ml-1">{notice.status}</span>
                          </Badge>
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
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{notice.content}</p>
                    </div>
                    {notice.attachments && notice.attachments.length > 0 && (
                      <div className="mt-4">
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
                    {notice.targetBoards && notice.targetBoards.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2 flex items-center">
                          <Monitor className="h-4 w-4 mr-2" />
                          Display Boards:
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {notice.targetBoards.map((assignment, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              Board ID: {assignment.boardId.slice(-6)} • Priority: {assignment.priority}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {notices.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">No notices found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {notices.map((notice) => (
                <Card key={notice._id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <CardTitle className="text-lg">{notice.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={getPriorityColor(notice.priority)}>
                            {notice.priority}
                          </Badge>
                          <Badge variant="outline">{notice.category}</Badge>
                          <Badge variant={getStatusColor(notice.status)}>
                            {getStatusIcon(notice.status)}
                            <span className="ml-1">{notice.status}</span>
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>By: {notice.submittedBy.name}</p>
                        <p>{formatDate(notice.createdAt)}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {notice.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {(user?.role === 'admin' || user?.role === 'super-admin') && (
          <TabsContent value="board-management">
            <BoardManager />
          </TabsContent>
        )}

        {(user?.role === 'admin' || user?.role === 'super-admin') && (
          <TabsContent value="content-scheduler">
            <ContentScheduler
              boards={[]} // TODO: Fetch boards from API
              onScheduleUpdate={() => fetchNotices()}
            />
          </TabsContent>
        )}

        {(user?.role === 'admin' || user?.role === 'super-admin') && (
          <TabsContent value="approved">
            <NoticePublishingPanel
              notices={approvedNotices}
              onRefresh={fetchNotices}
            />
          </TabsContent>
        )}

        {(user?.role === 'admin' || user?.role === 'super-admin') && (
          <TabsContent value="pending">
            <NoticeApprovalPanel
              notices={pendingNotices}
              onRefresh={fetchNotices}
            />
          </TabsContent>
        )}
      </Tabs>

      {showSubmissionForm && (
        <NoticeSubmissionForm
          onClose={() => setShowSubmissionForm(false)}
          onSuccess={() => {
            setShowSubmissionForm(false);
            fetchNotices();
          }}
        />
      )}
    </div>
  );
};

export default NoticeBoard;