import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Upload, FileText, Image, Video, File } from 'lucide-react';
import { noticesAPI } from '@/services/api';
import { NoticeSubmissionData } from '@/types';
import { toast } from 'sonner';

interface NoticeSubmissionFormProps {
  onSuccess?: () => void;
}

export const NoticeSubmissionForm: React.FC<NoticeSubmissionFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<NoticeSubmissionData>({
    title: '',
    content: '',
    type: 'text',
    priority: 'medium',
    tags: [],
    targetAudience: []
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [audienceInput, setAudienceInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof NoticeSubmissionData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/avi', 'video/mov', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type. Please select an image, video, or PDF file.');
        return;
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size too large. Maximum size is 50MB.');
        return;
      }

      setMediaFile(file);

      // Auto-detect file type
      if (file.type.startsWith('image/')) {
        setFormData(prev => ({ ...prev, type: 'image' }));
      } else if (file.type.startsWith('video/')) {
        setFormData(prev => ({ ...prev, type: 'video' }));
      } else if (file.type === 'application/pdf') {
        setFormData(prev => ({ ...prev, type: 'pdf' }));
      }
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const addAudience = () => {
    if (audienceInput.trim() && !formData.targetAudience?.includes(audienceInput.trim())) {
      setFormData(prev => ({
        ...prev,
        targetAudience: [...(prev.targetAudience || []), audienceInput.trim()]
      }));
      setAudienceInput('');
    }
  };

  const removeAudience = (audienceToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      targetAudience: prev.targetAudience?.filter(audience => audience !== audienceToRemove) || []
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Please enter a title for your notice.');
      return;
    }

    if (formData.type !== 'text' && !mediaFile) {
      toast.error('Please select a media file for this notice type.');
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      if (formData.content) submitData.append('content', formData.content);
      submitData.append('type', formData.type);
      if (formData.priority) submitData.append('priority', formData.priority);
      if (formData.tags?.length) submitData.append('tags', JSON.stringify(formData.tags));
      if (formData.targetAudience?.length) submitData.append('targetAudience', JSON.stringify(formData.targetAudience));
      if (mediaFile) submitData.append('media', mediaFile);

      await noticesAPI.submitNotice(submitData);

      toast.success('Notice submitted successfully! It will be reviewed by an administrator.');

      // Reset form
      setFormData({
        title: '',
        content: '',
        type: 'text',
        priority: 'medium',
        tags: [],
        targetAudience: []
      });
      setMediaFile(null);
      setTagInput('');
      setAudienceInput('');

      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit notice. Please try again.');
    } finally {
      setIsSubmitting(false);
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Submit Notice for Approval</CardTitle>
        <CardDescription>
          Create a notice that will be reviewed and approved by administrators before being displayed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
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

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter notice content (optional for media notices)"
              rows={4}
            />
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Notice Type</Label>
              <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Text Only
                    </div>
                  </SelectItem>
                  <SelectItem value="image">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      Image
                    </div>
                  </SelectItem>
                  <SelectItem value="video">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Video
                    </div>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <div className="flex items-center gap-2">
                      <File className="w-4 h-4" />
                      PDF Document
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Media Upload */}
          {formData.type !== 'text' && (
            <div className="space-y-2">
              <Label htmlFor="media">Media File *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="media"
                  type="file"
                  accept={formData.type === 'image' ? 'image/*' :
                         formData.type === 'video' ? 'video/*' : '.pdf'}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('media')?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {mediaFile ? mediaFile.name : 'Choose File'}
                </Button>
                {mediaFile && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getTypeIcon(formData.type)}
                    {(mediaFile.size / 1024 / 1024).toFixed(1)}MB
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} variant="outline">
                Add
              </Button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <Label htmlFor="audience">Target Audience</Label>
            <div className="flex gap-2">
              <Input
                id="audience"
                value={audienceInput}
                onChange={(e) => setAudienceInput(e.target.value)}
                placeholder="Add target audience (e.g., 'students', 'faculty')"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAudience())}
              />
              <Button type="button" onClick={addAudience} variant="outline">
                Add
              </Button>
            </div>
            {formData.targetAudience && formData.targetAudience.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.targetAudience.map((audience, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    {audience}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeAudience(audience)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};