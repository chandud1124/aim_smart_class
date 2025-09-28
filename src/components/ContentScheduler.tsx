import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Settings,
  Monitor,
  Calendar,
  Timer,
  Upload,
  Download,
  FileText,
  AlertTriangle,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

interface ScheduledContent {
  _id: string;
  title: string;
  content: string;
  type: 'default' | 'user' | 'emergency';
  priority: number;
  duration: number; // seconds
  schedule: {
    type: 'fixed' | 'recurring' | 'always';
    startTime?: string;
    endTime?: string;
    daysOfWeek?: number[];
    frequency?: 'daily' | 'weekly' | 'monthly';
    startDate?: string;
    endDate?: string;
    exceptions?: string[];
    timeSlots?: Array<{ start: string; end: string }>;
    playlist?: string[];
  };
  assignedBoards: string[];
  attachments?: Array<{
    type: 'image' | 'video' | 'document' | 'audio';
    filename: string;
    originalName: string;
    url: string;
    thumbnail?: string;
  }>;
  isActive: boolean;
  lastPlayed?: Date;
  playCount: number;
}

interface ContentSchedulerProps {
  boards: Array<{ _id: string; name: string; location: string; }>;
  onScheduleUpdate: () => void;
}

const ContentScheduler: React.FC<ContentSchedulerProps> = ({
  boards,
  onScheduleUpdate
}) => {
  const [scheduledContent, setScheduledContent] = useState<ScheduledContent[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<ScheduledContent | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isMediaUploadDialogOpen, setIsMediaUploadDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<FileList | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<Array<{
    type: 'image' | 'video' | 'document' | 'audio';
    filename: string;
    originalName: string;
    url: string;
    thumbnail?: string;
  }>>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [newContent, setNewContent] = useState({
    title: '',
    content: '',
    type: 'user' as 'default' | 'user' | 'emergency',
    priority: 1,
    duration: 60,
    schedule: {
      type: 'recurring' as 'fixed' | 'recurring' | 'always',
      startTime: '09:00',
      endTime: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
      frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
      startDate: '',
      endDate: '',
      exceptions: [] as string[],
      timeSlots: [{ start: '09:00', end: '17:00' }],
      playlist: [] as string[]
    },
    assignedBoards: [] as string[],
    selectedAttachments: [] as string[]
  });

  useEffect(() => {
    fetchScheduledContent();
    fetchUploadedMedia();
  }, []);

  const fetchScheduledContent = async () => {
    try {
      const response = await api.get('/content');
      setScheduledContent(response.data.content || []);
    } catch (error) {
      console.error('Error fetching scheduled content:', error);
      toast.error('Failed to fetch scheduled content');
    }
  };

  const fetchUploadedMedia = async () => {
    try {
      const response = await api.get('/content/uploaded-media');
      setUploadedMedia(response.data.media || []);
    } catch (error) {
      console.error('Error fetching uploaded media:', error);
      // Don't show error toast for media fetch as it's not critical
    }
  };

  const handleCreateContent = async () => {
    if (!newContent.title.trim() || !newContent.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    if (newContent.assignedBoards.length === 0) {
      toast.error('Please assign at least one board');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/content', newContent);

      if (response.status === 200 || response.status === 201) {
        toast.success('Content scheduled successfully');
        setIsCreateDialogOpen(false);
        resetNewContent();
        fetchScheduledContent();
        onScheduleUpdate();
      }
    } catch (error: any) {
      console.error('Error creating scheduled content:', error);
      toast.error(error.response?.data?.message || 'Failed to schedule content');
    } finally {
      setLoading(false);
    }
  };

  const resetNewContent = () => {
    setNewContent({
      title: '',
      content: '',
      type: 'user',
      priority: 1,
      duration: 60,
      schedule: {
        type: 'recurring',
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        frequency: 'daily',
        startDate: '',
        endDate: '',
        exceptions: [],
        timeSlots: [{ start: '09:00', end: '17:00' }],
        playlist: []
      },
      assignedBoards: [],
      selectedAttachments: []
    });
  };

  const handleImportContent = async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    setLoading(true);
    setImportProgress(0);
    setImportErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await api.post('/content/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200 || response.status === 201) {
        const result = response.data;
        setImportProgress(100);
        toast.success(`Successfully imported ${result.imported} content items`);
        if (result.errors.length > 0) {
          setImportErrors(result.errors);
        }
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchScheduledContent();
        onScheduleUpdate();
      } else {
        const error = response.data;
        toast.error(error.message || 'Failed to import content');
        setImportErrors([error.message || 'Import failed']);
      }
    } catch (error: any) {
      console.error('Error importing content:', error);
      toast.error('Failed to import content');
      setImportErrors(['Network error occurred during import']);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaUpload = async () => {
    if (!mediaFiles || mediaFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      Array.from(mediaFiles).forEach(file => {
        formData.append('files', file);
      });

      const response = await api.post('/content/upload-media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200 || response.status === 201) {
        const result = response.data;
        toast.success(`Successfully uploaded ${result.files.length} media files`);
        if (result.errors && result.errors.length > 0) {
          setImportErrors(result.errors.map(e => `${e.file}: ${e.error}`));
        }
        setIsMediaUploadDialogOpen(false);
        setMediaFiles(null);
        // Refresh the uploaded media list
        fetchUploadedMedia();
      } else {
        const error = response.data;
        toast.error(error.message || 'Failed to upload media files');
      }
    } catch (error: any) {
      console.error('Error uploading media files:', error);
      toast.error('Failed to upload media files');
    } finally {
      setLoading(false);
    }
  };

  const toggleContentStatus = async (contentId: string, isActive: boolean) => {
    try {
      const response = await api.patch(`/content/${contentId}`, { isActive });

      if (response.status === 200) {
        toast.success(`Content ${isActive ? 'activated' : 'deactivated'}`);
        fetchScheduledContent();
        onScheduleUpdate();
      }
    } catch (error: any) {
      console.error('Error toggling content status:', error);
      toast.error('Failed to update content status');
    }
  };

  const handleEditContent = (content: ScheduledContent) => {
    setEditingContent(content);
    setNewContent({
      title: content.title,
      content: content.content,
      type: content.type,
      priority: content.priority,
      duration: content.duration,
      schedule: {
        type: content.schedule.type,
        startTime: content.schedule.startTime || '09:00',
        endTime: content.schedule.endTime || '17:00',
        daysOfWeek: content.schedule.daysOfWeek || [1, 2, 3, 4, 5],
        frequency: content.schedule.frequency || 'daily',
        startDate: content.schedule.startDate || '',
        endDate: content.schedule.endDate || '',
        exceptions: content.schedule.exceptions || [],
        timeSlots: content.schedule.timeSlots || [{ start: '09:00', end: '17:00' }],
        playlist: content.schedule.playlist || []
      },
      assignedBoards: content.assignedBoards,
      selectedAttachments: content.attachments?.map(a => a.filename) || []
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateContent = async () => {
    if (!editingContent || !newContent.title.trim() || !newContent.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    if (newContent.assignedBoards.length === 0) {
      toast.error('Please assign at least one board');
      return;
    }

    setLoading(true);
    try {
      const response = await api.patch(`/content/${editingContent._id}`, newContent);

      if (response.status === 200) {
        toast.success('Content updated successfully');
        setIsEditDialogOpen(false);
        setEditingContent(null);
        resetNewContent();
        fetchScheduledContent();
        onScheduleUpdate();
      } else {
        const error = response.data;
        toast.error(error.message || 'Failed to update content');
      }
    } catch (error: any) {
      console.error('Error updating scheduled content:', error);
      toast.error('Failed to update content');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/content/${contentId}`);

      if (response.status === 200) {
        toast.success('Content deleted successfully');
        fetchScheduledContent();
        onScheduleUpdate();
      } else {
        const error = response.data;
        toast.error(error.message || 'Failed to delete content');
      }
    } catch (error: any) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'default': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-green-100 text-green-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScheduleDescription = (schedule: ScheduledContent['schedule']) => {
    switch (schedule.type) {
      case 'always':
        return 'Always playing';
      case 'fixed':
        return `${schedule.startTime} - ${schedule.endTime}`;
      case 'recurring': {
        const days = schedule.daysOfWeek?.map(d =>
          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]
        ).join(', ');
        return `${days} ${schedule.startTime} - ${schedule.endTime}`;
      }
      default:
        return 'Not scheduled';
    }
  };

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Content Scheduler</h3>
          <p className="text-sm text-gray-600">
            Schedule content to play automatically on display boards
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isMediaUploadDialogOpen} onOpenChange={setIsMediaUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload Media
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Media Files</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mediaFiles">Select media files</Label>
                  <Input
                    id="mediaFiles"
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    onChange={(e) => setMediaFiles(e.target.files)}
                  />
                  <p className="text-xs text-gray-500">
                    Supported: Images (JPG, PNG, GIF, WebP), Videos (MP4, AVI, MOV), Audio (MP3, WAV), Documents (PDF, DOC, DOCX)
                  </p>
                  <p className="text-xs text-gray-500">
                    Maximum 10 files, 100MB per file
                  </p>
                </div>
                {mediaFiles && mediaFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Files ({mediaFiles.length})</Label>
                    <div className="max-h-32 overflow-y-auto border rounded p-2">
                      {Array.from(mediaFiles).map((file, index) => (
                        <div key={index} className="text-sm text-gray-600">
                          {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsMediaUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleMediaUpload} disabled={loading || !mediaFiles || mediaFiles.length === 0}>
                    {loading ? 'Uploading...' : 'Upload Files'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Import Content
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Import Content from File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="importFile">Select CSV or Excel file</Label>
                  <Input
                    id="importFile"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-gray-500">
                    File should contain columns: title, content, type, priority, duration, schedule_type, start_time, end_time, days_of_week, assigned_boards
                  </p>
                </div>
                {importProgress > 0 && (
                  <div className="space-y-2">
                    <Label>Import Progress</Label>
                    <Progress value={importProgress} />
                  </div>
                )}
                {importErrors.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        {importErrors.map((error, index) => (
                          <p key={index} className="text-sm">{error}</p>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleImportContent} disabled={loading || !importFile}>
                    {loading ? 'Importing...' : 'Import Content'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Schedule Content
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule New Content</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newContent.title}
                    onChange={(e) => setNewContent(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Content title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Content Type</Label>
                  <Select
                    value={newContent.type}
                    onValueChange={(value: 'default' | 'user' | 'emergency') =>
                      setNewContent(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (Always Available)</SelectItem>
                      <SelectItem value="user">User Content (Scheduled)</SelectItem>
                      <SelectItem value="emergency">Emergency (High Priority)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  value={newContent.content}
                  onChange={(e) => setNewContent(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter the content to display"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority (1-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    max="10"
                    value={newContent.priority}
                    onChange={(e) => setNewContent(prev => ({
                      ...prev,
                      priority: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="5"
                    max="3600"
                    value={newContent.duration}
                    onChange={(e) => setNewContent(prev => ({
                      ...prev,
                      duration: parseInt(e.target.value) || 60
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduleType">Schedule Type</Label>
                  <Select
                    value={newContent.schedule.type}
                    onValueChange={(value: 'fixed' | 'recurring' | 'always') =>
                      setNewContent(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, type: value }
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always">Always Playing</SelectItem>
                      <SelectItem value="fixed">Fixed Time</SelectItem>
                      <SelectItem value="recurring">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newContent.schedule.type !== 'always' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={newContent.schedule.startTime}
                        onChange={(e) => setNewContent(prev => ({
                          ...prev,
                          schedule: { ...prev.schedule, startTime: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={newContent.schedule.endTime}
                        onChange={(e) => setNewContent(prev => ({
                          ...prev,
                          schedule: { ...prev.schedule, endTime: e.target.value }
                        }))}
                      />
                    </div>
                  </div>

                  {newContent.schedule.type === 'recurring' && (
                    <div className="space-y-2">
                      <Label>Days of Week</Label>
                      <div className="grid grid-cols-7 gap-2">
                        {daysOfWeek.map((day) => (
                          <div key={day.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`day-${day.value}`}
                              checked={newContent.schedule.daysOfWeek?.includes(day.value)}
                              onCheckedChange={(checked) => {
                                const currentDays = newContent.schedule.daysOfWeek || [];
                                const newDays = checked
                                  ? [...currentDays, day.value]
                                  : currentDays.filter(d => d !== day.value);
                                setNewContent(prev => ({
                                  ...prev,
                                  schedule: { ...prev.schedule, daysOfWeek: newDays }
                                }));
                              }}
                            />
                            <Label htmlFor={`day-${day.value}`} className="text-xs">
                              {day.label.slice(0, 3)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Advanced Scheduling Options */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium text-sm">Advanced Scheduling Options</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newContent.schedule.startDate}
                      onChange={(e) => setNewContent(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, startDate: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newContent.schedule.endDate}
                      onChange={(e) => setNewContent(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, endDate: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exceptions">Exception Dates (comma-separated)</Label>
                  <Input
                    id="exceptions"
                    value={newContent.schedule.exceptions.join(', ')}
                    onChange={(e) => setNewContent(prev => ({
                      ...prev,
                      schedule: { 
                        ...prev.schedule, 
                        exceptions: e.target.value.split(',').map(d => d.trim()).filter(d => d)
                      }
                    }))}
                    placeholder="2024-01-01, 2024-12-25"
                  />
                  <p className="text-xs text-gray-500">Dates when this content should not play</p>
                </div>

                <div className="space-y-2">
                  <Label>Time Slots</Label>
                  {newContent.schedule.timeSlots.map((slot, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={slot.start}
                        onChange={(e) => {
                          const newSlots = [...newContent.schedule.timeSlots];
                          newSlots[index].start = e.target.value;
                          setNewContent(prev => ({
                            ...prev,
                            schedule: { ...prev.schedule, timeSlots: newSlots }
                          }));
                        }}
                        className="w-32"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={slot.end}
                        onChange={(e) => {
                          const newSlots = [...newContent.schedule.timeSlots];
                          newSlots[index].end = e.target.value;
                          setNewContent(prev => ({
                            ...prev,
                            schedule: { ...prev.schedule, timeSlots: newSlots }
                          }));
                        }}
                        className="w-32"
                      />
                      {newContent.schedule.timeSlots.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newSlots = newContent.schedule.timeSlots.filter((_, i) => i !== index);
                            setNewContent(prev => ({
                              ...prev,
                              schedule: { ...prev.schedule, timeSlots: newSlots }
                            }));
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newSlots = [...newContent.schedule.timeSlots, { start: '09:00', end: '17:00' }];
                      setNewContent(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, timeSlots: newSlots }
                      }));
                    }}
                  >
                    Add Time Slot
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign to Boards *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-3">
                  {boards.map((board) => (
                    <div key={board._id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`board-${board._id}`}
                        checked={newContent.assignedBoards.includes(board._id)}
                        onCheckedChange={(checked) => {
                          const currentBoards = newContent.assignedBoards;
                          const newBoards = checked
                            ? [...currentBoards, board._id]
                            : currentBoards.filter(id => id !== board._id);
                          setNewContent(prev => ({ ...prev, assignedBoards: newBoards }));
                        }}
                      />
                      <Label htmlFor={`board-${board._id}`} className="text-sm">
                        {board.name} - {board.location}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Media Attachments Section */}
              <div className="space-y-2 border-t pt-4">
                <Label>Attach Media Files (Optional)</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Select from previously uploaded media files to attach to this content
                </p>
                <div className="max-h-40 overflow-y-auto border rounded p-3">
                  {uploadedMedia.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No media files uploaded yet. Upload media files first to attach them to content.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {uploadedMedia.map((media, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Checkbox
                            id={`media-${index}`}
                            checked={newContent.selectedAttachments.includes(media.filename)}
                            onCheckedChange={(checked) => {
                              const currentAttachments = newContent.selectedAttachments;
                              const newAttachments = checked
                                ? [...currentAttachments, media.filename]
                                : currentAttachments.filter(filename => filename !== media.filename);
                              setNewContent(prev => ({ ...prev, selectedAttachments: newAttachments }));
                            }}
                          />
                          <Label htmlFor={`media-${index}`} className="text-sm flex items-center gap-2">
                            {media.type === 'image' && '🖼️'}
                            {media.type === 'video' && '🎥'}
                            {media.type === 'audio' && '🎵'}
                            {media.type === 'document' && '📄'}
                            {media.originalName}
                            <span className="text-xs text-gray-500">
                              ({media.type})
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {newContent.selectedAttachments.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <FileText className="w-4 h-4" />
                    {newContent.selectedAttachments.length} media file(s) selected
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateContent} disabled={loading}>
                  {loading ? 'Scheduling...' : 'Schedule Content'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Content</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title *</Label>
                  <Input
                    id="edit-title"
                    value={newContent.title}
                    onChange={(e) => setNewContent(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Content title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Content Type</Label>
                  <Select
                    value={newContent.type}
                    onValueChange={(value: 'default' | 'user' | 'emergency') =>
                      setNewContent(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (Always Available)</SelectItem>
                      <SelectItem value="user">User Content (Scheduled)</SelectItem>
                      <SelectItem value="emergency">Emergency (High Priority)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-content">Content *</Label>
                <Textarea
                  id="edit-content"
                  value={newContent.content}
                  onChange={(e) => setNewContent(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter the content to display"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-priority">Priority (1-10)</Label>
                  <Input
                    id="edit-priority"
                    type="number"
                    min="1"
                    max="10"
                    value={newContent.priority}
                    onChange={(e) => setNewContent(prev => ({
                      ...prev,
                      priority: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-duration">Duration (seconds)</Label>
                  <Input
                    id="edit-duration"
                    type="number"
                    min="5"
                    max="3600"
                    value={newContent.duration}
                    onChange={(e) => setNewContent(prev => ({
                      ...prev,
                      duration: parseInt(e.target.value) || 60
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-scheduleType">Schedule Type</Label>
                  <Select
                    value={newContent.schedule.type}
                    onValueChange={(value: 'fixed' | 'recurring' | 'always') =>
                      setNewContent(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, type: value }
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always">Always Playing</SelectItem>
                      <SelectItem value="fixed">Fixed Time</SelectItem>
                      <SelectItem value="recurring">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newContent.schedule.type !== 'always' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-startTime">Start Time</Label>
                      <Input
                        id="edit-startTime"
                        type="time"
                        value={newContent.schedule.startTime}
                        onChange={(e) => setNewContent(prev => ({
                          ...prev,
                          schedule: { ...prev.schedule, startTime: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-endTime">End Time</Label>
                      <Input
                        id="edit-endTime"
                        type="time"
                        value={newContent.schedule.endTime}
                        onChange={(e) => setNewContent(prev => ({
                          ...prev,
                          schedule: { ...prev.schedule, endTime: e.target.value }
                        }))}
                      />
                    </div>
                  </div>

                  {newContent.schedule.type === 'recurring' && (
                    <div className="space-y-2">
                      <Label>Days of Week</Label>
                      <div className="grid grid-cols-7 gap-2">
                        {daysOfWeek.map((day) => (
                          <div key={day.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-day-${day.value}`}
                              checked={newContent.schedule.daysOfWeek?.includes(day.value)}
                              onCheckedChange={(checked) => {
                                const currentDays = newContent.schedule.daysOfWeek || [];
                                const newDays = checked
                                  ? [...currentDays, day.value]
                                  : currentDays.filter(d => d !== day.value);
                                setNewContent(prev => ({
                                  ...prev,
                                  schedule: { ...prev.schedule, daysOfWeek: newDays }
                                }));
                              }}
                            />
                            <Label htmlFor={`edit-day-${day.value}`} className="text-xs">
                              {day.label.slice(0, 3)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Assign to Boards *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-3">
                  {boards.map((board) => (
                    <div key={board._id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-board-${board._id}`}
                        checked={newContent.assignedBoards.includes(board._id)}
                        onCheckedChange={(checked) => {
                          const currentBoards = newContent.assignedBoards;
                          const newBoards = checked
                            ? [...currentBoards, board._id]
                            : currentBoards.filter(id => id !== board._id);
                          setNewContent(prev => ({ ...prev, assignedBoards: newBoards }));
                        }}
                      />
                      <Label htmlFor={`edit-board-${board._id}`} className="text-sm">
                        {board.name} - {board.location}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateContent} disabled={loading}>
                  {loading ? 'Updating...' : 'Update Content'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Content</TabsTrigger>
          <TabsTrigger value="inactive">Inactive Content</TabsTrigger>
          <TabsTrigger value="all">All Content</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {scheduledContent.filter(c => c.isActive).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Active Content</p>
              <p className="text-sm">Currently playing scheduled content will appear here with options to edit, delete, or pause them.</p>
            </div>
          ) : (
            scheduledContent.filter(c => c.isActive).map((content) => (
              <Card key={content._id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{content.title}</h4>
                        <Badge className={getTypeColor(content.type)}>
                          {content.type}
                        </Badge>
                        <Badge variant="outline">
                          Priority: {content.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {content.content}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {content.duration}s
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {getScheduleDescription(content.schedule)}
                        </span>
                        <span>Played: {content.playCount} times</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditContent(content)}
                        title="Edit this notice"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteContent(content._id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete this notice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleContentStatus(content._id, false)}
                        title="Pause this notice"
                      >
                        <Pause className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="inactive" className="space-y-4">
          {scheduledContent.filter(c => !c.isActive).map((content) => (
            <Card key={content._id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{content.title}</h4>
                      <Badge className={getTypeColor(content.type)}>
                        {content.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {content.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleContentStatus(content._id, true)}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {scheduledContent.map((content) => (
            <Card key={content._id} className={!content.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{content.title}</h4>
                      <Badge className={getTypeColor(content.type)}>
                        {content.type}
                      </Badge>
                      <Badge variant={content.isActive ? 'default' : 'secondary'}>
                        {content.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {content.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Boards: {content.assignedBoards.length}</span>
                      <span>Played: {content.playCount} times</span>
                      {content.lastPlayed && (
                        <span>Last: {new Date(content.lastPlayed).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleContentStatus(content._id, !content.isActive)}
                    >
                      {content.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContentScheduler;