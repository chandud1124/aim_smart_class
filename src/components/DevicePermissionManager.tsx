import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import api from '@/services/api';
import { Clock, Shield, Settings, User, Monitor, AlertCircle, CheckCircle } from 'lucide-react';

interface DevicePermission {
    _id: string;
    user: {
        _id: string;
        name: string;
        email: string;
        role: string;
    };
    device: {
        _id: string;
        name: string;
        type: string;
        classroom: string;
        mac: string;
    };
    permissions: {
        canTurnOn: boolean;
        canTurnOff: boolean;
        canViewStatus: boolean;
        canSchedule: boolean;
        canModifySettings: boolean;
        canViewHistory: boolean;
        canAdjustBrightness: boolean;
        canAdjustSpeed: boolean;
        canChangeInput: boolean;
        canConfigurePir: boolean;
        canViewPirData: boolean;
        canDisablePir: boolean;
    };
    restrictions: {
        maxUsesPerDay: number | null;
        usageToday: number;
        allowedTimeSlots: Array<{
            startTime: string;
            endTime: string;
            days: string[];
        }>;
        maxBrightnessLevel: number;
        maxFanSpeed: number;
        allowedInputSources: string[];
    };
    temporaryOverrides: {
        enabled: boolean;
        expiresAt?: string;
        reason?: string;
    };
    grantedBy: {
        name: string;
        email: string;
        role: string;
    };
    grantedAt: string;
    expiresAt?: string;
    isActive: boolean;
}

interface Device {
    _id: string;
    name: string;
    type: string;
    classroom: string;
    mac: string;
}

interface User {
    _id: string;
    name: string;
    email: string;
    role: string;
    department?: string;
}

const DevicePermissionManager: React.FC = () => {
    const { user } = useAuth();
    const { hasManagementAccess } = usePermissions();
    
    const [permissions, setPermissions] = useState<DevicePermission[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [granting, setGranting] = useState(false);
    
    // Form state
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedDevice, setSelectedDevice] = useState('');
    const [newPermissions, setNewPermissions] = useState({
        canTurnOn: true,
        canTurnOff: true,
        canViewStatus: true,
        canSchedule: false,
        canModifySettings: false,
        canViewHistory: false,
        canAdjustBrightness: false,
        canAdjustSpeed: false,
        canChangeInput: false,
        canConfigurePir: false,
        canViewPirData: true,
        canDisablePir: false,
    });
    const [newRestrictions, setNewRestrictions] = useState({
        maxUsesPerDay: null as number | null,
        allowedTimeSlots: [] as Array<{startTime: string, endTime: string, days: string[]}>,
        maxBrightnessLevel: 100,
        maxFanSpeed: 100,
        allowedInputSources: [] as string[],
    });
    const [expiresAt, setExpiresAt] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (hasManagementAccess) {
            loadData();
        }
    }, [hasManagementAccess]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [permissionsRes, devicesRes, usersRes] = await Promise.all([
                api.get('/device-permissions/summary'),
                api.get('/devices'),
                api.get('/users')
            ]);
            
            // Flatten permissions from summary format
            const flatPermissions = permissionsRes.data.data.flatMap((summary: { permissions: DevicePermission['permissions'][]; device: DevicePermission['device'] }) => 
                summary.permissions.map((perm: DevicePermission['permissions']) => ({
                    ...perm,
                    device: summary.device
                }))
            );
            
            setPermissions(flatPermissions);
            setDevices(devicesRes.data.data || []);
            setUsers(usersRes.data.data || []);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGrantPermission = async () => {
        if (!selectedUser || !selectedDevice) return;
        
        try {
            setGranting(true);
            await api.post('/device-permissions/grant', {
                userId: selectedUser,
                deviceId: selectedDevice,
                permissions: newPermissions,
                restrictions: newRestrictions,
                expiresAt: expiresAt || undefined,
                reason,
            });
            
            // Reset form
            setSelectedUser('');
            setSelectedDevice('');
            setNewPermissions({
                canTurnOn: true,
                canTurnOff: true,
                canViewStatus: true,
                canSchedule: false,
                canModifySettings: false,
                canViewHistory: false,
                canAdjustBrightness: false,
                canAdjustSpeed: false,
                canChangeInput: false,
                canConfigurePir: false,
                canViewPirData: true,
                canDisablePir: false,
            });
            setNewRestrictions({
                maxUsesPerDay: null,
                allowedTimeSlots: [],
                maxBrightnessLevel: 100,
                maxFanSpeed: 100,
                allowedInputSources: [],
            });
            setExpiresAt('');
            setReason('');
            
            loadData();
        } catch (error) {
            console.error('Error granting permission:', error);
        } finally {
            setGranting(false);
        }
    };

    const handleRevokePermission = async (permissionId: string) => {
        try {
            await api.delete(`/device-permissions/${permissionId}`);
            loadData();
        } catch (error) {
            console.error('Error revoking permission:', error);
        }
    };

    const handleTemporaryOverride = async (permissionId: string, minutes: number) => {
        try {
            await api.post(`/device-permissions/${permissionId}/override`, {
                durationMinutes: minutes,
                reason: 'Temporary admin override'
            });
            loadData();
        } catch (error) {
            console.error('Error granting override:', error);
        }
    };

    if (!hasManagementAccess) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-center text-muted-foreground">
                        <Shield className="mx-auto h-8 w-8 mb-2" />
                        <p>You don't have permission to manage device access.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-center">Loading device permissions...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Device Permission Manager
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="permissions">
                        <TabsList>
                            <TabsTrigger value="permissions">Current Permissions</TabsTrigger>
                            <TabsTrigger value="grant">Grant Access</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="permissions" className="space-y-4">
                            {permissions.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    No device permissions granted yet.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {permissions.map((permission) => (
                                        <Card key={permission._id} className="border-l-4 border-l-blue-500">
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <User className="h-4 w-4" />
                                                                <span className="font-medium">{permission.user.name}</span>
                                                                <Badge variant="secondary">{permission.user.role}</Badge>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                                                <Monitor className="h-4 w-4" />
                                                                <span>{permission.device.name}</span>
                                                                <Badge variant="outline">{permission.device.type}</Badge>
                                                                <span>{permission.device.classroom}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {user?.role === 'admin' && (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleTemporaryOverride(permission._id, 60)}
                                                                >
                                                                    Override 1h
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleTemporaryOverride(permission._id, 480)}
                                                                >
                                                                    Override 8h
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => handleRevokePermission(permission._id)}
                                                        >
                                                            Revoke
                                                        </Button>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    <div>
                                                        <h4 className="font-medium mb-2">Basic Controls</h4>
                                                        <div className="space-y-1 text-sm">
                                                            <div className="flex justify-between">
                                                                <span>Turn On</span>
                                                                {permission.permissions.canTurnOn ? 
                                                                    <CheckCircle className="h-4 w-4 text-green-500" /> :
                                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                                }
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Turn Off</span>
                                                                {permission.permissions.canTurnOff ? 
                                                                    <CheckCircle className="h-4 w-4 text-green-500" /> :
                                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                                }
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>View Status</span>
                                                                {permission.permissions.canViewStatus ? 
                                                                    <CheckCircle className="h-4 w-4 text-green-500" /> :
                                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div>
                                                        <h4 className="font-medium mb-2">Advanced Features</h4>
                                                        <div className="space-y-1 text-sm">
                                                            <div className="flex justify-between">
                                                                <span>Schedule</span>
                                                                {permission.permissions.canSchedule ? 
                                                                    <CheckCircle className="h-4 w-4 text-green-500" /> :
                                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                                }
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Settings</span>
                                                                {permission.permissions.canModifySettings ? 
                                                                    <CheckCircle className="h-4 w-4 text-green-500" /> :
                                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                                }
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>PIR Config</span>
                                                                {permission.permissions.canConfigurePir ? 
                                                                    <CheckCircle className="h-4 w-4 text-green-500" /> :
                                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div>
                                                        <h4 className="font-medium mb-2">Restrictions</h4>
                                                        <div className="space-y-1 text-sm">
                                                            {permission.restrictions.maxUsesPerDay && (
                                                                <div>Daily limit: {permission.restrictions.maxUsesPerDay}</div>
                                                            )}
                                                            {permission.restrictions.maxBrightnessLevel < 100 && (
                                                                <div>Max brightness: {permission.restrictions.maxBrightnessLevel}%</div>
                                                            )}
                                                            {permission.restrictions.maxFanSpeed < 100 && (
                                                                <div>Max fan speed: {permission.restrictions.maxFanSpeed}%</div>
                                                            )}
                                                            {permission.temporaryOverrides.enabled && (
                                                                <div className="text-yellow-600">
                                                                    <Clock className="h-4 w-4 inline mr-1" />
                                                                    Override active
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                                                    Granted by {permission.grantedBy.name} on {new Date(permission.grantedAt).toLocaleDateString()}
                                                    {permission.expiresAt && (
                                                        <span> • Expires {new Date(permission.expiresAt).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                        
                        <TabsContent value="grant" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor="user">User</Label>
                                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select user" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.map((user) => (
                                                <SelectItem key={user._id} value={user._id}>
                                                    {user.name} ({user.role})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div>
                                    <Label htmlFor="device">Device</Label>
                                    <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select device" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {devices.map((device) => (
                                                <SelectItem key={device._id} value={device._id}>
                                                    {device.name} - {device.classroom}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <h3 className="font-medium">Permissions</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.entries(newPermissions).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between">
                                            <Label htmlFor={key} className="text-sm">
                                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                            </Label>
                                            <Switch
                                                id={key}
                                                checked={value}
                                                onCheckedChange={(checked) => 
                                                    setNewPermissions(prev => ({ ...prev, [key]: checked }))
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <h3 className="font-medium">Restrictions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="maxUses">Max uses per day</Label>
                                        <Input
                                            id="maxUses"
                                            type="number"
                                            min="0"
                                            value={newRestrictions.maxUsesPerDay || ''}
                                            onChange={(e) => setNewRestrictions(prev => ({ 
                                                ...prev, 
                                                maxUsesPerDay: e.target.value ? parseInt(e.target.value) : null 
                                            }))}
                                            placeholder="Unlimited"
                                        />
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="maxBrightness">Max brightness (%)</Label>
                                        <Input
                                            id="maxBrightness"
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={newRestrictions.maxBrightnessLevel}
                                            onChange={(e) => setNewRestrictions(prev => ({ 
                                                ...prev, 
                                                maxBrightnessLevel: parseInt(e.target.value) || 100
                                            }))}
                                        />
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="maxFanSpeed">Max fan speed (%)</Label>
                                        <Input
                                            id="maxFanSpeed"
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={newRestrictions.maxFanSpeed}
                                            onChange={(e) => setNewRestrictions(prev => ({ 
                                                ...prev, 
                                                maxFanSpeed: parseInt(e.target.value) || 100
                                            }))}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="expiresAt">Expires At (optional)</Label>
                                    <Input
                                        id="expiresAt"
                                        type="datetime-local"
                                        value={expiresAt}
                                        onChange={(e) => setExpiresAt(e.target.value)}
                                    />
                                </div>
                                
                                <div>
                                    <Label htmlFor="reason">Reason</Label>
                                    <Input
                                        id="reason"
                                        placeholder="Reason for granting access"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <Button
                                onClick={handleGrantPermission}
                                disabled={!selectedUser || !selectedDevice || granting}
                                className="w-full"
                            >
                                {granting ? 'Granting Access...' : 'Grant Device Permission'}
                            </Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
};

export default DevicePermissionManager;
