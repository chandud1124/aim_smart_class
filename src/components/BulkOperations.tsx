import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Zap, 
  ZapOff, 
  Settings, 
  CheckSquare, 
  Square, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { deviceAPI, bulkAPI } from '@/services/api';
import { toast } from '@/hooks/use-toast';

interface Device {
  _id: string;
  name: string;
  location: string;
  classroom: string;
  switches: Array<{
    id: string;
    name: string;
    state: boolean;
  }>;
  isOnline: boolean;
}

interface BulkResult {
  successful: Array<{
    deviceId: string;
    switchId?: string;
    newState?: boolean;
  }>;
  failed: Array<{
    deviceId: string;
    error: string;
  }>;
}

export const BulkOperations: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedSwitch, setSelectedSwitch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [lastResult, setLastResult] = useState<BulkResult | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await deviceAPI.getAllDevices();
      setDevices(response.data.data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch devices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(devices.filter(d => d.isOnline).map(d => d._id));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedDevices(prev => [...prev, deviceId]);
    } else {
      setSelectedDevices(prev => prev.filter(id => id !== deviceId));
    }
  };

  const handleBulkToggle = async (state: boolean) => {
    if (selectedDevices.length === 0 || !selectedSwitch) {
      toast({
        title: "Warning",
        description: "Please select devices and a switch to control",
        variant: "destructive",
      });
      return;
    }

    try {
      setOperating(true);
      const response = await bulkAPI.toggleSwitches(selectedDevices, selectedSwitch, state);
      setLastResult(response.data.results);
      
      toast({
        title: "Success",
        description: `Bulk ${state ? 'ON' : 'OFF'} operation completed`,
      });

      // Refresh devices to show updated states
      await fetchDevices();
    } catch (error: any) {
      console.error('Bulk operation failed:', error);
      toast({
        title: "Error",
        description: error.message || "Bulk operation failed",
        variant: "destructive",
      });
    } finally {
      setOperating(false);
    }
  };

  const getAvailableSwitches = () => {
    const switchMap = new Map();
    devices.forEach(device => {
      device.switches?.forEach(sw => {
        if (!switchMap.has(sw.id)) {
          switchMap.set(sw.id, sw.name);
        }
      });
    });
    return Array.from(switchMap.entries());
  };

  const onlineDevices = devices.filter(d => d.isOnline);
  const isAllSelected = onlineDevices.length > 0 && selectedDevices.length === onlineDevices.length;
  const isPartiallySelected = selectedDevices.length > 0 && selectedDevices.length < onlineDevices.length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Bulk Operations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading devices...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Bulk Operations
          </CardTitle>
          <CardDescription>
            Control multiple devices simultaneously
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Device Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Device Selection</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className={isPartiallySelected ? "data-[state=checked]:bg-orange-500" : ""}
                />
                <span className="text-sm text-muted-foreground">
                  Select All Online ({onlineDevices.length})
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {devices.map((device) => (
                <div
                  key={device._id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    !device.isOnline ? 'bg-gray-50 opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedDevices.includes(device._id)}
                      onCheckedChange={(checked) => handleSelectDevice(device._id, !!checked)}
                      disabled={!device.isOnline}
                    />
                    <div>
                      <p className="text-sm font-medium">{device.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.classroom} - {device.location}
                      </p>
                    </div>
                  </div>
                  <Badge variant={device.isOnline ? "default" : "secondary"}>
                    {device.isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Switch Selection */}
          <div>
            <h4 className="text-sm font-medium mb-2">Select Switch to Control</h4>
            <Select value={selectedSwitch} onValueChange={setSelectedSwitch}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a switch..." />
              </SelectTrigger>
              <SelectContent>
                {getAvailableSwitches().map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => handleBulkToggle(true)}
              disabled={operating || selectedDevices.length === 0 || !selectedSwitch}
              className="flex-1"
            >
              {operating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Turn All ON
            </Button>
            <Button
              onClick={() => handleBulkToggle(false)}
              disabled={operating || selectedDevices.length === 0 || !selectedSwitch}
              variant="outline"
              className="flex-1"
            >
              {operating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ZapOff className="w-4 h-4 mr-2" />
              )}
              Turn All OFF
            </Button>
          </div>

          {/* Selection Summary */}
          {selectedDevices.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {selectedDevices.length} device{selectedDevices.length !== 1 ? 's' : ''} selected
                {selectedSwitch && ` • Switch: ${getAvailableSwitches().find(([id]) => id === selectedSwitch)?.[1]}`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Last Operation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {lastResult.successful.length}
                </div>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {lastResult.failed.length}
                </div>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>

            {lastResult.failed.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-600">Failed Operations:</h4>
                {lastResult.failed.map((failure, index) => (
                  <div key={index} className="text-xs bg-red-50 p-2 rounded border-l-2 border-red-200">
                    <p className="font-medium">Device ID: {failure.deviceId}</p>
                    <p className="text-red-600">{failure.error}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkOperations;
