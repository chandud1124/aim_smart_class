import React, { useState, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch as ToggleSwitch } from '@/components/ui/switch';
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  Settings, 
  Trash2,
  AlertCircle
} from 'lucide-react';
import { SwitchControl } from './SwitchControl';
import { Device } from '@/types';



interface DeviceCardProps {
  device: Device;
  onToggleSwitch: (deviceId: string, switchId: string) => void;
  onEditDevice?: (device: Device) => void; // request opening shared edit dialog
  onDeleteDevice?: (deviceId: string) => void;
  showSwitches?: boolean;
  showActions?: boolean;
  compact?: boolean; // If true, show only basic details and online/offline
}

  export default memo(function DeviceCard({ device, onToggleSwitch, onEditDevice, onDeleteDevice, showSwitches = true, showActions = true, compact = false }: DeviceCardProps) {
    const [aiEnabled, setAiEnabled] = useState(device.aiEnabled ?? false);

    const handleAiToggle = (checked: boolean) => {
      setAiEnabled(checked);
      // TODO: Persist to backend if needed
    };

    // In dashboard (showActions === false), highlight card green if online, red if offline
    const isOnline = device.status === 'online';
    const dashboardOnline = !showActions && isOnline;
    const dashboardOffline = !showActions && !isOnline;
    const deviceOffline = !isOnline; // Apply red styling to offline devices in all views

    return (
      <Card
        style={{
          minWidth: '250px',
          maxWidth: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          padding: '0.75rem',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: dashboardOnline
            ? '#166534' // Tailwind green-800 for dark online
            : (dashboardOffline || deviceOffline)
              ? '#b91c1c' // Tailwind red-700 for offline
              : undefined,
          color: (dashboardOffline || deviceOffline) ? '#fff' : undefined,
          fontWeight: (dashboardOffline || deviceOffline) ? 'bold' : undefined
        }}
        className={`shadow-md hover:shadow-lg transition-shadow duration-200 sm:max-w-xs sm:p-2 sm:overflow-hidden relative${dashboardOnline ? ' ring-4 ring-green-600' : ''}${(dashboardOffline || deviceOffline) ? ' opacity-70 grayscale' : ''}`}
      >
        {/* AI/ML Toggle */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <ToggleSwitch checked={aiEnabled} onCheckedChange={handleAiToggle} />
          <span className="text-xs" title="AI/ML Control: ON = AI can control device, OFF = AI only shows insights">AI</span>
        </div>
        {/* Status Indicator - Top Left */}
        <div className="absolute top-2 left-2 z-10">
          <Badge
            variant={isOnline ? 'secondary' : 'destructive'}
            className={`text-xs ${isOnline
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-red-100 text-red-700 border-red-200'
            } ${!isOnline ? 'bg-white/20 text-white border-white/30' : ''}`}
          >
            {isOnline ? (
              <>
                <div className="w-2 h-2 bg-emerald-500 rounded-full mr-1 animate-pulse" />
                Online
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 mr-1" />
                Offline
              </>
            )}
          </Badge>
        </div>

      {/* Settings & Delete Buttons in compact mode - Top Right */}
      {compact && showActions && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEditDevice && onEditDevice(device)}
            title="Edit Device"
          >
            <Settings className="h-3 w-3" />
          </Button>
          {onDeleteDevice && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => onDeleteDevice(device.id)}
              title="Delete Device"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      <CardHeader className="flex flex-col gap-2 pb-2 px-2">
        <div className="w-full flex flex-col gap-1 items-center text-center">
          <CardTitle className="text-lg font-semibold leading-tight truncate mb-1 flex flex-col items-center justify-center" style={{maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
            <span>
              {device.name}
              {device.classroom && !device.name.includes(device.classroom) && ` (${device.classroom})`}
            </span>
          </CardTitle>
          <div className="flex flex-col items-center gap-1 w-full">
            <div className={`text-xs ${deviceOffline ? 'text-white/70' : 'text-muted-foreground'} truncate w-full`} style={{maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {device.classroom ? `Classroom: ${device.classroom}` : `Location: ${device.location}`}
            </div>
          </div>
        </div>
      </CardHeader>
      { !compact && (
        <CardContent>
          {/* ...existing code for details, switches, PIR, actions... */}
          <div className="grid gap-4 w-full p-0" style={{overflow: 'hidden'}}>
            {/* Device Details */}
            <div className={`flex flex-col gap-1 text-xs ${device.status === 'online' ? 'text-muted-foreground' : 'text-white/80'} bg-muted/50 rounded p-2 w-full`}>
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center gap-2 w-full overflow-hidden">
                  <span className={`font-medium ${device.status === 'online' ? 'text-primary' : 'text-white'} min-w-[60px]`}>MAC:</span>
                  <span className={`truncate max-w-[140px] ${device.status === 'online' ? '' : 'text-white/90'}`}>{device.macAddress}</span>
                </div>
                <div className="flex items-center gap-2 w-full overflow-hidden">
                  <span className={`font-medium ${device.status === 'online' ? '' : 'text-white'} min-w-[60px]`}>Location:</span>
                  <span className={`truncate max-w-[140px] ${device.status === 'online' ? '' : 'text-white/90'}`}>{device.location}</span>
                </div>
                {device.classroom && (
                  <div className="flex items-center gap-2 w-full overflow-hidden">
                    <span className={`font-medium ${device.status === 'online' ? '' : 'text-white'} min-w-[60px]`}>Classroom:</span>
                    <span className={`truncate max-w-[140px] ${device.status === 'online' ? '' : 'text-white/90'}`}>{device.classroom}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 w-full overflow-hidden">
                  <span className={`font-medium ${device.status === 'online' ? '' : 'text-white'} min-w-[60px]`}>Last seen:</span>
                  <span className={`truncate max-w-[140px] ${device.status === 'online' ? '' : 'text-white/90'}`}>{new Date(device.lastSeen).toLocaleString()}</span>
                </div>
              </div>
            </div>
            {/* Switches Table (conditionally rendered) */}
            {showSwitches && (
              <div className="mt-4">
                <div className={`font-semibold text-sm mb-1 px-0 ${device.status === 'online' ? '' : 'text-white'}`}>Switches ({device.switches.length})</div>
                {device.switches.length === 0 ? (
                  <div className={`text-xs ${device.status === 'online' ? 'text-muted-foreground' : 'text-white/70'} px-0`}>No switches configured</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className={`px-2 py-1 text-left ${device.status === 'online' ? '' : 'text-white'}`}>Name</th>
                          <th className={`px-2 py-1 text-left ${device.status === 'online' ? '' : 'text-white'}`}>GPIO</th>
                          <th className={`px-2 py-1 text-left ${device.status === 'online' ? '' : 'text-white'}`}>Type</th>
                          <th className={`px-2 py-1 text-left ${device.status === 'online' ? '' : 'text-white'}`}>Manual</th>
                          <th className={`px-2 py-1 text-left ${device.status === 'online' ? '' : 'text-white'}`}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {device.switches.map((sw, i) => {
                          const isOn = sw.state;
                          return (
                            <tr
                              key={sw.id || `${sw.name}-${sw.gpio ?? sw.relayGpio ?? i}`}
                              className={
                                `${device.status !== 'online' ? 'opacity-60' : ''} ${isOn ? (device.status === 'online' ? 'bg-green-100 text-green-900' : 'bg-red-200 text-red-900') : ''}`
                              }
                            >
                              <td className={`truncate px-2 py-1 min-w-[70px] max-w-[120px] ${isOn ? 'font-semibold' : ''} ${device.status === 'online' ? '' : 'text-white/90'}`}>{sw.name}</td>
                              <td className={`truncate px-2 py-1 min-w-[40px] max-w-[60px] ${isOn ? 'font-semibold' : ''} ${device.status === 'online' ? '' : 'text-white/90'}`}>{sw.gpio ?? sw.relayGpio}</td>
                              <td className={`truncate px-2 py-1 min-w-[60px] max-w-[100px] ${isOn ? 'font-semibold' : ''} ${device.status === 'online' ? '' : 'text-white/90'}`}>{sw.type}</td>
                              <td className={`truncate px-2 py-1 min-w-[40px] max-w-[60px] ${isOn ? 'font-semibold' : ''} ${device.status === 'online' ? '' : 'text-white/90'}`}>{sw.manualSwitchEnabled ? 'Yes' : 'No'}</td>
                              <td className="px-2 py-1">
                                <Button
                                  size="sm"
                                  variant={isOn ? 'default' : 'outline'}
                                  onClick={() => {
                                    const sid = sw.id;
                                    if (sid) onToggleSwitch(device.id, sid);
                                    else console.warn('Switch missing id when toggling', sw);
                                  }}
                                  disabled={device.status !== 'online'}
                                  title={isOn ? 'Turn Off' : 'Turn On'}
                                >
                                  {isOn ? 'On' : 'Off'}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* PIR Sensor Info */}
            {device.pirEnabled && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${device.status === 'online' ? '' : 'text-white'}`}>PIR Sensor</span>
                  <Badge variant="outline" className={device.pirEnabled ? (device.status === 'online' ? 'bg-green-500/10' : 'bg-white/20 text-white border-white/30') : 'bg-muted'}>
                    {device.pirEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div className={`text-xs ${device.status === 'online' ? 'text-muted-foreground' : 'text-white/70'}`}>
                  {device.pirGpio && `GPIO ${device.pirGpio} • `}
                  Auto-off delay: {device.pirAutoOffDelay || 30}s
                </div>
              </div>
            )}

            {/* Settings & Delete Buttons at the very bottom (conditionally rendered) */}
            {showActions && (
              <div className="flex justify-end items-center gap-2 w-full mt-6">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEditDevice && onEditDevice(device)}
                  title="Edit Device"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                {onDeleteDevice && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onDeleteDevice(device.id)}
                    title="Delete Device"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
});


