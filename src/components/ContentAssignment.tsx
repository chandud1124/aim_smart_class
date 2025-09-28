import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Clock, Users, Target, Play, Pause, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Board {
  _id: string;
  name: string;
  location: string;
  type: 'digital' | 'physical' | 'hybrid';
  status: 'active' | 'inactive' | 'maintenance';
  groupId?: {
    _id: string;
    name: string;
  };
  isOnline: boolean;
}

interface Notice {
  _id: string;
  title: string;
  content: string;
  priority: number;
  category: string;
  status: 'draft' | 'approved' | 'published' | 'archived';
  targetBoards: Array<{
    boardId: string;
    assignedBy: string;
    priority: number;
    displayOrder: number;
  }>;
}

interface ContentAssignmentProps {
  notice: Notice;
  onAssignmentChange: () => void;
}

const ContentAssignment: React.FC<ContentAssignmentProps> = ({
  notice,
  onAssignmentChange
}) => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [assignmentSettings, setAssignmentSettings] = useState<Record<string, {
    duration: number;
    priority: number;
    displayOrder: number;
  }>>({});
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  useEffect(() => {
    fetchBoards();
    initializeAssignments();
  }, [notice]);

  const fetchBoards = async () => {
    try {
      const response = await fetch('/api/boards?status=active');
      if (response.ok) {
        const data = await response.json();
        setBoards(data.boards);
      }
    } catch (error) {
      console.error('Error fetching boards:', error);
      toast.error('Failed to fetch boards');
    } finally {
      setLoading(false);
    }
  };

  const initializeAssignments = () => {
    const currentAssignments = notice.targetBoards || [];
    const selected = currentAssignments.map(assignment => assignment.boardId);
    setSelectedBoards(selected);

    const settings: Record<string, any> = {};
    currentAssignments.forEach(assignment => {
      settings[assignment.boardId] = {
        duration: 60, // Default duration
        priority: assignment.priority,
        displayOrder: assignment.displayOrder
      };
    });
    setAssignmentSettings(settings);
  };

  const handleBoardSelection = (boardId: string, checked: boolean) => {
    if (checked) {
      setSelectedBoards(prev => [...prev, boardId]);
      setAssignmentSettings(prev => ({
        ...prev,
        [boardId]: {
          duration: 60,
          priority: 0,
          displayOrder: 0
        }
      }));
    } else {
      setSelectedBoards(prev => prev.filter(id => id !== boardId));
      setAssignmentSettings(prev => {
        const newSettings = { ...prev };
        delete newSettings[boardId];
        return newSettings;
      });
    }
  };

  const handleSettingChange = (boardId: string, field: string, value: number) => {
    setAssignmentSettings(prev => ({
      ...prev,
      [boardId]: {
        ...prev[boardId],
        [field]: value
      }
    }));
  };

  const handleAssignContent = async () => {
    try {
      // First, remove from boards that are no longer selected
      const currentBoardIds = notice.targetBoards?.map(a => a.boardId) || [];
      const boardsToRemove = currentBoardIds.filter(id => !selectedBoards.includes(id));

      for (const boardId of boardsToRemove) {
        await fetch(`/api/boards/${boardId}/content`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ noticeId: null }), // Clear content
        });
      }

      // Then assign to selected boards
      for (const boardId of selectedBoards) {
        const settings = assignmentSettings[boardId];
        await fetch(`/api/boards/${boardId}/content`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            noticeId: notice._id,
            duration: settings.duration,
            priority: settings.priority
          }),
        });
      }

      toast.success('Content assigned successfully');
      setIsAssignDialogOpen(false);
      onAssignmentChange();
    } catch (error) {
      console.error('Error assigning content:', error);
      toast.error('Failed to assign content');
    }
  };

  const getBoardStatusBadge = (board: Board) => {
    if (!board.isOnline) {
      return <Badge variant="destructive">Offline</Badge>;
    }
    if (board.status === 'maintenance') {
      return <Badge variant="secondary">Maintenance</Badge>;
    }
    return <Badge variant="default">Online</Badge>;
  };

  const getAssignedBoards = () => {
    return boards.filter(board => selectedBoards.includes(board._id));
  };

  if (loading) {
    return <div className="flex justify-center items-center h-32">Loading boards...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Content Assignment</h3>
          <p className="text-sm text-gray-600">
            Assign this notice to display boards
          </p>
        </div>
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Target className="w-4 h-4 mr-2" />
              Manage Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign Notice to Boards</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-3">Available Boards</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {boards.map((board) => (
                      <div key={board._id} className="flex items-center space-x-3 p-2 border rounded">
                        <Checkbox
                          id={`board-${board._id}`}
                          checked={selectedBoards.includes(board._id)}
                          onCheckedChange={(checked) =>
                            handleBoardSelection(board._id, checked as boolean)
                          }
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{board.name}</span>
                            {getBoardStatusBadge(board)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {board.location} • {board.type}
                            {board.groupId && ` • ${board.groupId.name}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Assignment Settings</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedBoards.map((boardId) => {
                      const board = boards.find(b => b._id === boardId);
                      const settings = assignmentSettings[boardId];

                      if (!board) return null;

                      return (
                        <Card key={boardId}>
                          <CardContent className="p-3">
                            <div className="font-medium text-sm mb-2">{board.name}</div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label htmlFor={`duration-${boardId}`} className="text-xs">
                                  Duration (sec)
                                </Label>
                                <Input
                                  id={`duration-${boardId}`}
                                  type="number"
                                  min="5"
                                  max="3600"
                                  value={settings.duration}
                                  onChange={(e) =>
                                    handleSettingChange(boardId, 'duration', parseInt(e.target.value))
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`priority-${boardId}`} className="text-xs">
                                  Priority
                                </Label>
                                <Input
                                  id={`priority-${boardId}`}
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={settings.priority}
                                  onChange={(e) =>
                                    handleSettingChange(boardId, 'priority', parseInt(e.target.value))
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`order-${boardId}`} className="text-xs">
                                  Display Order
                                </Label>
                                <Input
                                  id={`order-${boardId}`}
                                  type="number"
                                  min="0"
                                  value={settings.displayOrder}
                                  onChange={(e) =>
                                    handleSettingChange(boardId, 'displayOrder', parseInt(e.target.value))
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignContent}>
                  Assign Content
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Assignments Display */}
      <div className="space-y-3">
        <h4 className="font-medium">Currently Assigned To:</h4>
        {getAssignedBoards().length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {getAssignedBoards().map((board) => (
              <Card key={board._id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-4 h-4" />
                    <span className="font-medium">{board.name}</span>
                  </div>
                  {getBoardStatusBadge(board)}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {board.location}
                </div>
                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  <span>Duration: {assignmentSettings[board._id]?.duration || 60}s</span>
                  <span>Priority: {assignmentSettings[board._id]?.priority || 0}</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Monitor className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No boards assigned</p>
            <p className="text-sm">Click "Manage Assignment" to assign this notice to boards</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentAssignment;