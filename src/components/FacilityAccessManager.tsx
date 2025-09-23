import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, Clock, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '@/services/api';

interface FacilityAccess {
    _id: string;
    classroom: string;
    user: {
        _id: string;
        name: string;
        email: string;
    };
    permissions: {
        canControl: boolean;
        canSchedule: boolean;
        canViewLogs: boolean;
        canModifySettings: boolean;
        timeRestriction: {
            enabled: boolean;
            startTime: string;
            endTime: string;
        };
        deviceRestrictions: string[];
    };
    grantedBy: {
        _id: string;
        name: string;
    };
    grantedAt: string;
    reason: string;
    expiresAt?: string;
    isActive: boolean;
}

interface User {
    _id: string;
    name: string;
    email: string;
    role: string;
}

export const FacilityAccessManager: React.FC = () => {
    const { user } = useAuth();
    const { hasManagementAccess } = usePermissions();
    const [accessRecords, setAccessRecords] = useState<FacilityAccess[]>([]);
    const [facilities, setFacilities] = useState<string[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [granting, setGranting] = useState(false);
    const [revoking, setRevoking] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form states
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedFacility, setSelectedFacility] = useState('');
    const [reason, setReason] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    
    // Permission states
    const [canControl, setCanControl] = useState(true);
    const [canSchedule, setCanSchedule] = useState(false);
    const [canViewLogs, setCanViewLogs] = useState(true);
    const [canModifySettings, setCanModifySettings] = useState(false);
    const [timeRestrictionEnabled, setTimeRestrictionEnabled] = useState(false);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    
    const [debugMode, setDebugMode] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            console.log('Loading facility access data...');
            
            // Load facilities from device list
            const [facilitiesRes, usersRes, accessRes] = await Promise.all([
                api.get('/api/facility/summary'),  // This gets unique facilities from devices
                api.get('/api/users'),
                api.get('/api/facility/all')  // This gets access records
            ]);

            console.log('Facilities response:', facilitiesRes.data);
            console.log('Users response:', usersRes.data);
            console.log('Access response:', accessRes.data);

            setFacilities(facilitiesRes.data.data.map((c: { classroom: string }) => c.classroom));
            setUsers(usersRes.data.data);
            setAccessRecords(accessRes.data.data || []);
            
            console.log('Data loaded successfully');
        } catch (err: unknown) {
            let errorMessage = 'Failed to load data';
            if (err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'message' in err.response.data && typeof err.response.data.message === 'string') {
                errorMessage = err.response.data.message;
            } else if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
                errorMessage = (err as { message: string }).message;
            }
            console.error('Error loading data:', errorMessage);
            setError(errorMessage);
            setFacilities([]);
            setUsers([]);
            setAccessRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const handleGrantAccess = async () => {
        if (!selectedUser || !selectedFacility) return;
        
        try {
            setGranting(true);
            setError(null);
            
            const response = await api.post('/api/facility/grant', {
                userId: selectedUser,
                classroom: selectedFacility,
                permissions: {
                    canControl,
                    canSchedule,
                    canViewLogs,
                    canModifySettings,
                    timeRestriction: {
                        enabled: timeRestrictionEnabled,
                        startTime,
                        endTime
                    },
                    deviceRestrictions: []
                },
                reason,
                expiresAt: expirationDate || undefined
            });
            
            setSuccess('Access granted successfully');
            setSelectedUser('');
            setSelectedFacility('');
            setReason('');
            setExpirationDate('');
            
            // Reset permissions to defaults
            setCanControl(true);
            setCanSchedule(false);
            setCanViewLogs(true);
            setCanModifySettings(false);
            setTimeRestrictionEnabled(false);
            
            await loadData();
        } catch (err: unknown) {
            let errorMessage = 'Failed to grant access';
            if (err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'message' in err.response.data && typeof err.response.data.message === 'string') {
                errorMessage = err.response.data.message;
            } else if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
                errorMessage = (err as any).message;
            }
            console.error('Error granting access:', errorMessage);
            setError(errorMessage);
        } finally {
            setGranting(false);
        }
    };

    const handleRevokeAccess = async (accessId: string) => {
        try {
            setRevoking(accessId);
            setError(null);
            
            await api.delete(`/api/facility/${accessId}`);
            setSuccess('Access revoked successfully');
            await loadData();
        } catch (err: unknown) {
            let errorMessage = 'Failed to revoke access';
            if (err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'message' in err.response.data && typeof err.response.data.message === 'string') {
                errorMessage = err.response.data.message;
            } else if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
                errorMessage = (err as any).message;
            }
            console.error('Error revoking access:', errorMessage);
            setError(errorMessage);
        } finally {
            setRevoking(null);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    if (!hasManagementAccess) {
        return (
            <RoleGuard roles={['super-admin', 'admin', 'faculty']}>
                <div className="p-6">
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            You do not have permission to manage facility access.
                        </AlertDescription>
                    </Alert>
                </div>
            </RoleGuard>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="ml-2">Loading facility access data...</span>
                </div>
            </div>
        );
    }

    return (
        <RoleGuard roles={['super-admin', 'admin', 'faculty']}>
            <div className="container mx-auto px-4 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Facility Access Management</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage user access permissions for facilities and devices
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadData}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDebugMode(!debugMode)}
                        >
                            Debug: {debugMode ? 'ON' : 'OFF'}
                        </Button>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {success && (
                    <Alert className="border-green-200 bg-green-50">
                        <Shield className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                            {success}
                        </AlertDescription>
                    </Alert>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            {error}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Grant Access Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Grant Facility Access
                        </CardTitle>
                        <CardDescription>
                            Grant specific users access to facilities with customizable permissions
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* User Selection */}
                            <div className="space-y-2">
                                <Label htmlFor="user-select">User</Label>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger id="user-select">
                                        <SelectValue placeholder="Select user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.length === 0 ? (
                                            <SelectItem value="no-users" disabled>
                                                No users available
                                            </SelectItem>
                                        ) : (
                                            users.map(user => (
                                                <SelectItem key={user._id} value={user._id}>
                                                    {user.name} ({user.email})
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Facility Selection */}
                            <div className="space-y-2">
                                <Label htmlFor="facility-select">Facility</Label>
                                <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                                    <SelectTrigger id="facility-select">
                                        <SelectValue placeholder="Select facility" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {facilities.length === 0 ? (
                                            <SelectItem value="no-facilities" disabled>
                                                No facilities available. Try refreshing the page.
                                            </SelectItem>
                                        ) : (
                                            facilities.map(facility => (
                                                <SelectItem key={facility} value={facility}>
                                                    {facility}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Permissions */}
                        <div className="space-y-4">
                            <Label className="text-base font-medium">Permissions</Label>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="can-control"
                                        checked={canControl}
                                        onCheckedChange={(checked) => setCanControl(checked === true)}
                                    />
                                    <Label htmlFor="can-control">Device Control</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="can-schedule"
                                        checked={canSchedule}
                                        onCheckedChange={(checked) => setCanSchedule(checked === true)}
                                    />
                                    <Label htmlFor="can-schedule">Schedule Management</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="can-view-logs"
                                        checked={canViewLogs}
                                        onCheckedChange={(checked) => setCanViewLogs(checked === true)}
                                    />
                                    <Label htmlFor="can-view-logs">View Activity Logs</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="can-modify-settings"
                                        checked={canModifySettings}
                                        onCheckedChange={(checked) => setCanModifySettings(checked === true)}
                                    />
                                    <Label htmlFor="can-modify-settings">Modify Settings</Label>
                                </div>
                            </div>
                        </div>

                        {/* Time Restrictions */}
                        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="time-restriction"
                    checked={timeRestrictionEnabled}
                    onCheckedChange={(checked) => setTimeRestrictionEnabled(checked === true)}
                />
                <Label htmlFor="time-restriction">Enable Time Restrictions</Label>
            </div>                            {timeRestrictionEnabled && (
                                <div className="grid md:grid-cols-2 gap-4 ml-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="start-time">Start Time</Label>
                                        <Input
                                            id="start-time"
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end-time">End Time</Label>
                                        <Input
                                            id="end-time"
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Additional Fields */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="expiration">Expiration Date (Optional)</Label>
                                <Input
                                    id="expiration"
                                    type="datetime-local"
                                    value={expirationDate}
                                    onChange={(e) => setExpirationDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reason">Reason *</Label>
                                <Input
                                    id="reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Required reason for granting facility access"
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleGrantAccess}
                            disabled={granting || !selectedUser || !selectedFacility}
                            className="w-full md:w-auto"
                        >
                            {granting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Grant Access
                        </Button>
                    </CardContent>
                </Card>

                {/* Access Records */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Active Facility Access
                        </CardTitle>
                        <CardDescription>
                            Active facility access permissions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {accessRecords.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">
                                No facility access records found.
                            </p>
                        ) : (
                            <div className="space-y-4" role="list" aria-label="Current facility access records">
                                {accessRecords.map((record) => (
                                    <div
                                        key={record._id}
                                        className="flex items-center justify-between p-4 border rounded-lg"
                                        role="listitem"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="font-medium">{record.classroom}</h3>
                                                <Badge variant={record.isActive ? "default" : "secondary"}>
                                                    {record.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                User: {record.user.name} ({record.user.email})
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Granted: {new Date(record.grantedAt).toLocaleString()}
                                            </p>
                                            {record.reason && (
                                                <p className="text-sm text-muted-foreground">
                                                    Reason: {record.reason}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleRevokeAccess(record._id)}
                                            disabled={revoking === record._id}
                                            aria-label={`Revoke access for ${record.user.name} to ${record.classroom}`}
                                        >
                                            {revoking === record._id && (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            )}
                                            Revoke
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Debug Information */}
                {debugMode && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Debug Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm font-mono">
                                <div><strong>Current User:</strong> {user?.name} ({user?.email})</div>
                                <div><strong>User Role:</strong> {user?.role}</div>
                                <div><strong>Users Loaded:</strong> {users.length}</div>
                                <div><strong>Facilities Loaded:</strong> {facilities.length}</div>
                                <div><strong>Access Records:</strong> {accessRecords.length}</div>
                                <div><strong>Selected User:</strong> {selectedUser || 'None'}</div>
                                <div><strong>Selected Facility:</strong> {selectedFacility || 'None'}</div>
                                <div><strong>Loading State:</strong> {loading ? 'Yes' : 'No'}</div>
                                <div><strong>Granting State:</strong> {granting ? 'Yes' : 'No'}</div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </RoleGuard>
    );
};

export default FacilityAccessManager;
