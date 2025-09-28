import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Monitor, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

interface Board {
  _id: string;
  name: string;
  location: string;
  type: 'digital' | 'physical' | 'hybrid';
  status: 'active' | 'inactive' | 'maintenance';
  groupId?: {
    _id: string;
    name: string;
    type: string;
  };
  isOnline: boolean;
}

interface BoardSelectorProps {
  selectedBoards: string[];
  onSelectionChange: (boardIds: string[]) => void;
  maxSelections?: number;
}

const BoardSelector: React.FC<BoardSelectorProps> = ({
  selectedBoards,
  onSelectionChange,
  maxSelections
}) => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      const response = await api.get('/boards?status=active&includeInactive=false');
      setBoards(response.data.boards || []);
    } catch (error) {
      console.error('Error fetching boards:', error);
      toast.error('Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  const handleBoardToggle = (boardId: string, checked: boolean) => {
    if (checked) {
      if (maxSelections && selectedBoards.length >= maxSelections) {
        toast.warning(`You can select a maximum of ${maxSelections} boards`);
        return;
      }
      onSelectionChange([...selectedBoards, boardId]);
    } else {
      onSelectionChange(selectedBoards.filter(id => id !== boardId));
    }
  };

  const getBoardStatusBadge = (board: Board) => {
    if (!board.isOnline) {
      return <Badge variant="destructive" className="text-xs">Offline</Badge>;
    }
    if (board.status === 'maintenance') {
      return <Badge variant="secondary" className="text-xs">Maintenance</Badge>;
    }
    return <Badge variant="default" className="text-xs">Online</Badge>;
  };

  const getBoardTypeIcon = (type: string) => {
    switch (type) {
      case 'digital': return '🖥️';
      case 'physical': return '📋';
      case 'hybrid': return '📱';
      default: return '📺';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-sm text-gray-500">Loading available boards...</div>
        </CardContent>
      </Card>
    );
  }

  if (boards.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center text-gray-500">
            <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No display boards available</p>
            <p className="text-xs">Contact administrator to set up display boards</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group boards by location for better organization
  const boardsByLocation = boards.reduce((acc, board) => {
    const location = board.location || 'Unknown Location';
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(board);
    return acc;
  }, {} as Record<string, Board[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Monitor className="w-5 h-5 mr-2" />
          Select Display Boards
        </CardTitle>
        <p className="text-sm text-gray-600">
          Choose which boards you want this notice to be displayed on
          {maxSelections && ` (max ${maxSelections})`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(boardsByLocation).map(([location, locationBoards]) => (
          <div key={location} className="space-y-3">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <h4 className="font-medium text-sm">{location}</h4>
              <Badge variant="outline" className="text-xs">
                {locationBoards.length} board{locationBoards.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
              {locationBoards.map((board) => (
                <div
                  key={board._id}
                  className={`border rounded-lg p-3 transition-colors ${
                    selectedBoards.includes(board._id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={`board-${board._id}`}
                      checked={selectedBoards.includes(board._id)}
                      onCheckedChange={(checked) =>
                        handleBoardToggle(board._id, checked as boolean)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <Label
                          htmlFor={`board-${board._id}`}
                          className="font-medium text-sm cursor-pointer flex items-center"
                        >
                          <span className="mr-2">{getBoardTypeIcon(board.type)}</span>
                          {board.name}
                        </Label>
                        {getBoardStatusBadge(board)}
                      </div>

                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {board.type} • {board.groupId ? board.groupId.name : 'No Group'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {selectedBoards.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800 mb-2">
              Selected Boards ({selectedBoards.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedBoards.map((boardId) => {
                const board = boards.find(b => b._id === boardId);
                return board ? (
                  <Badge key={boardId} variant="secondary" className="text-xs">
                    {board.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BoardSelector;