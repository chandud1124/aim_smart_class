import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NoticeSubmissionForm } from '@/components/NoticeSubmissionForm';
import { NoticeApprovalPanel } from '@/components/NoticeApprovalPanel';
import { noticesAPI } from '@/services/api';
import { Notice } from '@/types';
import { FileText, Image, Video, File, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';

export const NoticeBoardPage: React.FC = () => {
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('submit');
  const [myNotices, setMyNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user data from localStorage
    const stored = localStorage.getItem('user_data');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const userData = { id: parsed.id, role: parsed.role || null };
        setUser(userData);
        // Set initial tab based on role
        setActiveTab(userData.role === 'admin' || userData.role === 'super-admin' ? 'approval' : 'submit');
      } catch {}
    }
    loadMyNotices();
  }, []);

  const loadMyNotices = async () => {
    try {
      const response = await noticesAPI.getMyNotices();
      setMyNotices(response.data || []);
    } catch (error) {
      console.error('Failed to load notices:', error);
    } finally {
      setLoading(false);
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
        return <Badge variant="outline"><Eye className="w-3 h-3 mr-1" />Scheduled</Badge>;
      case 'active':
        return <Badge variant="default"><Eye className="w-3 h-3 mr-1" />Active</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'pdf': return <File className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notice Board</h1>
          <p className="text-muted-foreground">
            Submit notices for approval and manage display scheduling
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue={isAdmin ? "approval" : "submit"} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="submit">Submit Notice</TabsTrigger>
          <TabsTrigger value="my-notices">My Notices ({myNotices.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="approval">Admin Panel</TabsTrigger>}
        </TabsList>

        <TabsContent value="submit" className="space-y-6">
          <NoticeSubmissionForm onSuccess={loadMyNotices} />
        </TabsContent>

        <TabsContent value="my-notices" className="space-y-6">
          {loading ? (
            <div className="flex justify-center p-8">Loading your notices...</div>
          ) : myNotices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No notices yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  You haven't submitted any notices for approval yet.
                </p>
                <Button onClick={() => setActiveTab('submit')}>
                  Submit Your First Notice
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myNotices.map((notice) => (
                <Card key={notice._id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(notice.type)}
                        <CardTitle className="text-lg">{notice.title}</CardTitle>
                      </div>
                      {getStatusBadge(notice.status)}
                    </div>
                    <CardDescription>
                      Submitted on {format(new Date(notice.createdAt), 'PPP')}
                      {notice.approvedAt && ` • ${notice.status === 'approved' ? 'Approved' : 'Processed'} on ${format(new Date(notice.approvedAt), 'PPP')}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {notice.content && (
                      <p className="text-sm text-muted-foreground mb-4">{notice.content}</p>
                    )}

                    {notice.rejectionReason && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 text-red-800 mb-1">
                          <XCircle className="w-4 h-4" />
                          <span className="font-medium">Rejection Reason</span>
                        </div>
                        <p className="text-red-700 text-sm">{notice.rejectionReason}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {notice.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                    </div>

                    {notice.mediaUrl && (
                      <div className="mt-4">
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {getTypeIcon(notice.type)}
                          Media file attached
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="approval" className="space-y-6">
            <NoticeApprovalPanel onNoticeUpdate={loadMyNotices} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};