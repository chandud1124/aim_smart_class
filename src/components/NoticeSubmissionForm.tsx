import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import { NoticeSubmissionData } from '@/types';
import BoardSelector from './BoardSelector';

interface NoticeSubmissionFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const NoticeSubmissionForm: React.FC<NoticeSubmissionFormProps> = ({ onClose, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const [formData, setFormData] = useState<NoticeSubmissionData>({
    title: '',
    content: '',
    priority: 'medium',
    category: 'general',
    targetAudience: {},
    selectedBoards: [],
    attachments: []
  });

  const handleInputChange = (field: keyof NoticeSubmissionData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `${file.name} is larger than 10MB`,
          variant: 'destructive'
        });
        return false;
      }
      return true;
    });

    setAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('content', formData.content);
      submitData.append('priority', formData.priority);
      submitData.append('category', formData.category);

      if (formData.expiryDate) {
        submitData.append('expiryDate', formData.expiryDate);
      }

      if (formData.targetAudience.roles?.length) {
        submitData.append('targetAudienceRoles', JSON.stringify(formData.targetAudience.roles));
      }

      if (formData.targetAudience.departments?.length) {
        submitData.append('targetAudienceDepartments', JSON.stringify(formData.targetAudience.departments));
      }

      if (formData.targetAudience.classes?.length) {
        submitData.append('targetAudienceClasses', JSON.stringify(formData.targetAudience.classes));
      }

      if (formData.selectedBoards?.length) {
        submitData.append('selectedBoards', JSON.stringify(formData.selectedBoards));
      }

      attachments.forEach((file, index) => {
        submitData.append('attachments', file);
      });

      const response = await api.post('/notices/submit', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        toast({
          title: 'Notice submitted successfully',
          description: 'Your notice has been submitted for approval.'
        });
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit notice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Notice</DialogTitle>
          <DialogDescription>
            Fill out the form below to submit a new notice. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter notice title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter notice content"
              rows={6}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleInputChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="administrative">Administrative</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
            <Input
              id="expiryDate"
              type="date"
              value={formData.expiryDate || ''}
              onChange={(e) => handleInputChange('expiryDate', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachments">Attachments (Optional)</Label>
            <div className="space-y-2">
              <Input
                id="attachments"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                onChange={handleFileChange}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-sm text-muted-foreground">
                Supported formats: PDF, DOC, DOCX, JPG, PNG, TXT. Max 10MB per file.
              </p>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files:</Label>
                <div className="space-y-1">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <BoardSelector
            selectedBoards={formData.selectedBoards || []}
            onSelectionChange={(boardIds) => handleInputChange('selectedBoards', boardIds)}
            maxSelections={5}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Notice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { NoticeSubmissionForm };
