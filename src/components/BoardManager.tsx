import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Plus, Edit, Trash2, Monitor, Tv, Smartphone, Settings, Cpu } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import api from '@/services/api';

const getStatusBadge = (status: string) => {
  const variants = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
    offline: 'bg-red-100 text-red-800'
  };
  return variants[status as keyof typeof variants] || variants.inactive;
};

interface Board {
  _id: string;
  name: string;
  description: string;
  location: string;
  type: 'digital' | 'physical' | 'projector' | 'tv' | 'monitor' | 'raspberry_pi';
  status: 'active' | 'inactive' | 'maintenance' | 'offline';
  displaySettings: {
    resolution: string;
    orientation: 'landscape' | 'portrait';
    brightness: number;
  };
  schedule: {
    operatingHours: {
      start: string;
      end: string;
    };
  };
  groupId?: {
    _id: string;
    name: string;
    type: string;
  };
  assignedUsers: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  macAddress?: string;
  ipAddress?: string;
  isOnline: boolean;
  stats: {
    totalPlayTime: number;
    noticesDisplayed: number;
    lastMaintenance: Date;
  };
}

interface BoardGroup {
  _id: string;
  name: string;
  type: 'department' | 'location' | 'building' | 'custom';
  boards: Array<{
    _id: string;
    name: string;
    status: string;
  }>;
}

const BoardManager: React.FC = () => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    type: 'raspberry_pi' as 'raspberry_pi',
    displaySettings: {
      resolution: '1920x1080',
      orientation: 'landscape' as 'landscape' | 'portrait',
      brightness: 80
    },
    schedule: {
      operatingHours: {
        start: '08:00',
        end: '18:00'
      }
    },
    groupId: '',
    macAddress: '',
    ipAddress: ''
  });

  useEffect(() => {
    fetchBoards();
    fetchBoardGroups();
  }, []);

  const fetchBoards = async () => {
    try {
      const response = await api.get('/boards');
      setBoards(response.data.boards || []);
    } catch (error) {
      console.error('Error fetching boards:', error);
      toast.error('Failed to fetch boards');
    } finally {
      setLoading(false);
    }
  };

  const fetchBoardGroups = async () => {
    try {
      const response = await api.get('/boards/groups');
      setBoardGroups(response.data.boardGroups || []);
    } catch (error) {
      console.error('Error fetching board groups:', error);
    }
  };

  const handleCreateBoard = async () => {
    console.log('Form data being sent:', formData);

    // Prepare data to send, excluding null/empty groupId
    const dataToSend = { ...formData };
    if (!dataToSend.groupId) {
      delete dataToSend.groupId;
    }

    console.log('Data to send after cleaning:', dataToSend);

    try {
      const response = await api.post('/boards', dataToSend);
      toast.success('Board created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchBoards();
    } catch (error: any) {
      console.error('Error creating board:', error);
      console.error('Full error response:', error.response?.data);
      // Show specific validation errors if available
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.map((err: any) => err.msg).join(', ');
        console.error('Validation errors:', error.response.data.errors);
        toast.error(`Validation failed: ${errorMessages}`);
      } else {
        toast.error(error.response?.data?.message || 'Failed to create board');
      }
    }
  };

  const handleUpdateBoard = async () => {
    if (!selectedBoard) return;

    // Prepare data to send, excluding null/empty groupId
    const dataToSend = { ...formData };
    if (!dataToSend.groupId) {
      delete dataToSend.groupId;
    }

    try {
      await api.patch(`/boards/${selectedBoard._id}`, dataToSend);
      toast.success('Board updated successfully');
      setIsEditDialogOpen(false);
      resetForm();
      fetchBoards();
    } catch (error: any) {
      console.error('Error updating board:', error);
      // Show specific validation errors if available
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.map((err: any) => err.msg).join(', ');
        toast.error(`Validation failed: ${errorMessages}`);
      } else {
        toast.error(error.response?.data?.message || 'Failed to update board');
      }
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (!confirm('Are you sure you want to delete this board?')) return;

    try {
      await api.delete(`/boards/${boardId}`);
      toast.success('Board deleted successfully');
      fetchBoards();
    } catch (error: any) {
      console.error('Error deleting board:', error);
      toast.error(error.response?.data?.message || 'Failed to delete board');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      location: '',
      type: 'raspberry_pi',
      displaySettings: {
        resolution: '1920x1080',
        orientation: 'landscape',
        brightness: 80
      },
      schedule: {
        operatingHours: {
          start: '08:00',
          end: '18:00'
        }
      },
      groupId: null,
      macAddress: '',
      ipAddress: ''
    });
    setSelectedBoard(null);
  };

  const openEditDialog = (board: Board) => {
    setSelectedBoard(board);
    setFormData({
      name: board.name,
      description: board.description || '',
      location: board.location,
      type: 'raspberry_pi',
      displaySettings: {
        resolution: board.displaySettings?.resolution || '1920x1080',
        orientation: board.displaySettings?.orientation || 'landscape',
        brightness: board.displaySettings?.brightness || 80
      },
      schedule: {
        operatingHours: {
          start: board.schedule?.operatingHours?.start || '08:00',
          end: board.schedule?.operatingHours?.end || '18:00'
        }
      },
      groupId: board.groupId?._id || null,
      macAddress: board.macAddress || '',
      ipAddress: board.ipAddress || ''
    });
    setIsEditDialogOpen(true);
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      digital: Monitor,
      physical: Tv,
      projector: Tv,
      tv: Tv,
      monitor: Monitor,
      raspberry_pi: Cpu
    };
    const Icon = icons[type as keyof typeof icons] || Monitor;
    return <Icon className="w-4 h-4" />;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Board Management</h1>
          <p className="text-gray-600">Manage display boards and their configurations</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Board
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Board</DialogTitle>
              <DialogDescription>
                Add a new Raspberry Pi display board to your system. Configure its network settings, location, and display settings.
              </DialogDescription>
            </DialogHeader>
            <BoardForm
              formData={formData}
              setFormData={setFormData}
              boardGroups={boardGroups}
              onSubmit={handleCreateBoard}
              submitLabel="Create Board"
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="boards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="boards">Display Boards</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="boards" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <Card key={board._id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(board.type)}
                      <CardTitle className="text-lg">{board.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusBadge(board.status)}>
                        {board.status}
                      </Badge>
                      {board.isOnline ? (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      ) : (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-600">{board.description}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Location:</span>
                      <span>{board.location}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Resolution:</span>
                      <span>{board.displaySettings.resolution}</span>
                    </div>
                    {board.type === 'raspberry_pi' && board.macAddress && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">MAC:</span>
                        <span className="font-mono text-xs">{board.macAddress}</span>
                      </div>
                    )}
                    {board.type === 'raspberry_pi' && board.ipAddress && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">IP:</span>
                        <span className="font-mono text-xs">{board.ipAddress}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Group:</span>
                      <span>{board.groupId?.name || 'None'}</span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(board)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBoard(board._id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {boards.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No boards found. Create your first board to get started.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <BoardGroupsManager
            boardGroups={boardGroups}
            boards={boards}
            onGroupsChange={fetchBoardGroups}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Board</DialogTitle>
            <DialogDescription>
              Modify the Raspberry Pi board configuration, display settings, and group assignment.
            </DialogDescription>
          </DialogHeader>
          <BoardForm
            formData={formData}
            setFormData={setFormData}
            boardGroups={boardGroups}
            onSubmit={handleUpdateBoard}
            submitLabel="Update Board"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface BoardFormProps {
  formData: any;
  setFormData: (data: any) => void;
  boardGroups: BoardGroup[];
  onSubmit: () => void;
  submitLabel: string;
}

const BoardForm: React.FC<BoardFormProps> = ({
  formData,
  setFormData,
  boardGroups,
  onSubmit,
  submitLabel
}) => {
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  const validateBoardName = (name: string) => {
    if (!name.trim()) return 'Board name is required';
    if (name.length < 2 || name.length > 100) return 'Board name must be between 2 and 100 characters';
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) return 'Board name can only contain letters, numbers, spaces, hyphens, and underscores';
    return '';
  };

  const validateLocation = (location: string) => {
    if (!location.trim()) return 'Location is required';
    if (location.length < 2 || location.length > 100) return 'Location must be between 2 and 100 characters';
    return '';
  };

  const validateMacAddress = (mac: string) => {
    if (!mac.trim()) return ''; // MAC is optional
    const macRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i;
    if (!macRegex.test(mac)) return 'MAC address must be in format XX:XX:XX:XX:XX:XX';
    return '';
  };

  const validateIpAddress = (ip: string) => {
    if (!ip.trim()) return ''; // IP is optional
    const ipRegex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    if (!ipRegex.test(ip)) return 'IP address must be a valid IPv4 format';
    return '';
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });

    // Validate the field
    let error = '';
    switch (field) {
      case 'name':
        error = validateBoardName(value);
        break;
      case 'location':
        error = validateLocation(value);
        break;
      case 'macAddress':
        error = validateMacAddress(value);
        break;
      case 'ipAddress':
        error = validateIpAddress(value);
        break;
    }

    setValidationErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields before submission
    const errors: {[key: string]: string} = {};
    errors.name = validateBoardName(formData.name);
    errors.location = validateLocation(formData.location);
    errors.macAddress = validateMacAddress(formData.macAddress);
    errors.ipAddress = validateIpAddress(formData.ipAddress);

    // Remove empty error messages
    Object.keys(errors).forEach(key => {
      if (!errors[key]) delete errors[key];
    });

    setValidationErrors(errors);

    // If no validation errors, proceed with submission
    if (Object.keys(errors).length === 0) {
      console.log('Submitting form data:', formData);
      onSubmit();
    } else {
      console.log('Validation errors found:', errors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Board Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            required
            className={validationErrors.name ? 'border-red-500' : ''}
          />
          {validationErrors.name && (
            <p className="text-sm text-red-500 mt-1">{validationErrors.name}</p>
          )}
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            required
            className={validationErrors.location ? 'border-red-500' : ''}
          />
          {validationErrors.location && (
            <p className="text-sm text-red-500 mt-1">{validationErrors.location}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="groupId">Board Group (Optional)</Label>
        <Select
          value={formData.groupId || "none"}
          onValueChange={(value) => setFormData({ ...formData, groupId: value === "none" ? null : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Group</SelectItem>
            {boardGroups.map((group) => (
              <SelectItem key={group._id} value={group._id}>
                {group.name} ({group.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-3">Raspberry Pi Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="macAddress">MAC Address</Label>
            <Input
              id="macAddress"
              value={formData.macAddress}
              onChange={(e) => handleInputChange('macAddress', e.target.value)}
              placeholder="B8:27:EB:XX:XX:XX"
              className={validationErrors.macAddress ? 'border-red-500' : ''}
            />
            {validationErrors.macAddress && (
              <p className="text-sm text-red-500 mt-1">{validationErrors.macAddress}</p>
            )}
          </div>
          <div>
            <Label htmlFor="ipAddress">IP Address</Label>
            <Input
              id="ipAddress"
              value={formData.ipAddress}
              onChange={(e) => handleInputChange('ipAddress', e.target.value)}
              placeholder="192.168.1.100"
              className={validationErrors.ipAddress ? 'border-red-500' : ''}
            />
            {validationErrors.ipAddress && (
              <p className="text-sm text-red-500 mt-1">{validationErrors.ipAddress}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-3">Display Settings</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="resolution">Resolution</Label>
            <Select
              value={formData.displaySettings.resolution}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  displaySettings: { ...formData.displaySettings, resolution: value }
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select resolution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1920x1080">1920x1080 (FHD)</SelectItem>
                <SelectItem value="2560x1440">2560x1440 (QHD)</SelectItem>
                <SelectItem value="3840x2160">3840x2160 (4K)</SelectItem>
                <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="orientation">Orientation</Label>
            <Select
              value={formData.displaySettings.orientation}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  displaySettings: { ...formData.displaySettings, orientation: value }
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select orientation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landscape">Landscape</SelectItem>
                <SelectItem value="portrait">Portrait</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="brightness">Brightness (%)</Label>
            <Input
              id="brightness"
              type="number"
              min="0"
              max="100"
              value={formData.displaySettings.brightness}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  displaySettings: {
                    ...formData.displaySettings,
                    brightness: parseInt(e.target.value)
                  }
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-3">Operating Hours</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startTime">Start Time</Label>
            <Input
              id="startTime"
              type="time"
              value={formData.schedule.operatingHours.start}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  schedule: {
                    ...formData.schedule,
                    operatingHours: {
                      ...formData.schedule.operatingHours,
                      start: e.target.value
                    }
                  }
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="endTime">End Time</Label>
            <Input
              id="endTime"
              type="time"
              value={formData.schedule.operatingHours.end}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  schedule: {
                    ...formData.schedule,
                    operatingHours: {
                      ...formData.schedule.operatingHours,
                      end: e.target.value
                    }
                  }
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
};

interface BoardGroupsManagerProps {
  boardGroups: BoardGroup[];
  boards: Board[];
  onGroupsChange: () => void;
}

const BoardGroupsManager: React.FC<BoardGroupsManagerProps> = ({
  boardGroups,
  boards,
  onGroupsChange
}) => {
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    type: 'department' as const
  });

  const handleCreateGroup = async () => {
    try {
      await api.post('/boards/groups', groupFormData);
      toast.success('Board group created successfully');
      setIsCreateGroupDialogOpen(false);
      setGroupFormData({ name: '', description: '', type: 'department' });
      onGroupsChange();
    } catch (error: any) {
      console.error('Error creating board group:', error);
      toast.error(error.response?.data?.message || 'Failed to create board group');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Board Groups</h2>
        <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Board Group</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateGroup(); }} className="space-y-4">
              <div>
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="groupDescription">Description</Label>
                <Input
                  id="groupDescription"
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="groupType">Type</Label>
                <Select
                  value={groupFormData.type}
                  onValueChange={(value: any) => setGroupFormData({ ...groupFormData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="building">Building</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button type="submit">Create Group</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {boardGroups.map((group) => (
          <Card key={group._id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {group.name}
                <Badge variant="outline">{group.type}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">{group.boards.length} boards</p>
              <div className="space-y-2">
                {group.boards.slice(0, 3).map((board) => (
                  <div key={board._id} className="flex items-center justify-between text-sm">
                    <span>{board.name}</span>
                    <Badge className={getStatusBadge(board.status)}>
                      {board.status}
                    </Badge>
                  </div>
                ))}
                {group.boards.length > 3 && (
                  <p className="text-sm text-gray-500">
                    +{group.boards.length - 3} more boards
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {boardGroups.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No board groups found. Create your first group to organize boards.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default BoardManager;