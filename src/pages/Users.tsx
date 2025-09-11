import React, { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Users as UsersIcon, Plus, Shield, User, Edit, Trash2, GraduationCap, ShieldCheck, RefreshCcw, Search, Wrench } from 'lucide-react';
import { UserDialog } from '@/components/UserDialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import io from 'socket.io-client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'supervisor' | 'technician' | 'operator' | 'security' | 'user';
  isActive: boolean;
  lastLogin: Date;
  assignedDevices: string[];
  department?: string;
  accessLevel: 'full' | 'limited' | 'readonly';
  isOnline?: boolean;
  lastSeen?: Date;
  isApproved?: boolean;
  registrationDate?: string;
}

const Users = () => {
  // Customizable columns
  const allColumns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department' },
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'designation', label: 'Designation' },
    { key: 'isActive', label: 'Status' },
    { key: 'isApproved', label: 'Approval' },
    { key: 'lastSeen', label: 'Last Seen' },
    { key: 'registrationDate', label: 'Registered' }
  ];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(allColumns.map(c => c.key));

  // CSV Export
  const handleExportCSV = () => {
    const rows = users.map(u =>
      visibleColumns.map(col => JSON.stringify(u[col] ?? '')).join(',')
    );
    const header = visibleColumns.join(',');
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV Import (basic)
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // TODO: Parse CSV and send to backend for bulk import
      toast({ title: 'Import', description: 'CSV import not yet implemented', variant: 'default' });
    };
    reader.readAsText(file);
  };
  // Advanced filter states
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const departmentOptions = [
  'all',
  'Information Technology',
  'Business Administration',
  'Management Studies',
  'Security',
  'Maintenance',
  'Administration',
  'Library',
  'Sports',
  'Other'
  ];
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Bulk selection
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(9); // 3 cards per row * 3 rows
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [me, setMe] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [socket, setSocket] = useState<any>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // load self id and role once
  useEffect(() => {
    const stored = localStorage.getItem('user_data');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMe(parsed.id);
        setMyRole(parsed.role || null);
      } catch {}
    }
  }, []);

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const response = await api.get('/users/online');
      const onlineUsersList = response.data.data;
      console.log('[DEBUG] Online users from backend:', onlineUsersList);
      const onlineUserIds = new Set<string>(onlineUsersList.map((user: any) => user._id.toString()));
      setOnlineUsers(onlineUserIds);
    } catch (error) {
      console.error('Failed to fetch online users:', error);
    }
  }, []);

  // Fetch online users on component mount
  useEffect(() => {
    fetchOnlineUsers();
    const interval = setInterval(() => {
      fetchOnlineUsers();
    }, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [fetchOnlineUsers]);

  // Socket connection for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const socketConnection = io(process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001', {
      auth: { token }
    });

    socketConnection.on('connect', () => {
      console.log('Connected to server for real-time updates');
      setSocketConnected(true);
      // Authenticate the socket connection
      socketConnection.emit('authenticate', token);
    });

    socketConnection.on('authenticated', (data: any) => {
      console.log('Socket authentication successful');
    });

    socketConnection.on('auth_error', (error: any) => {
      console.error('Socket authentication error:', error);
      setSocketConnected(false);
    });

    socketConnection.on('user_status_change', (data: any) => {
      console.log('User status change:', data);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (data.isOnline) {
          newSet.add(data.userId);
        } else {
          newSet.delete(data.userId);
        }
        return newSet;
      });
    });

    socketConnection.on('disconnect', () => {
      console.log('Disconnected from server');
      setSocketConnected(false);
    });

    socketConnection.on('connect_error', (error: any) => {
      console.error('Socket connection error:', error);
      setSocketConnected(false);
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (roleFilter !== 'all') params.role = roleFilter;
      if (departmentFilter !== 'all') params.department = departmentFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await api.get('/users', { params });
      const payload = response.data;
      const list = payload.data || [];
      let normalized = list.map((u: any) => ({
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLogin: u.lastLogin ? new Date(u.lastLogin) : new Date(),
        assignedDevices: u.assignedDevices || [],
        department: u.department,
        accessLevel: u.accessLevel || 'limited',
        lastSeen: u.lastSeen,
        registrationDate: u.registrationDate,
        isApproved: u.isApproved
      }));
      // Frontend filter for all dropdowns
      if (roleFilter !== 'all') {
        normalized = normalized.filter(u => u.role === roleFilter);
      }
      if (departmentFilter !== 'all') {
        normalized = normalized.filter(u => (u.department || '').toLowerCase() === departmentFilter.toLowerCase());
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'active') normalized = normalized.filter(u => u.isActive);
        else if (statusFilter === 'inactive') normalized = normalized.filter(u => !u.isActive);
        else if (statusFilter === 'pending') normalized = normalized.filter(u => u.isApproved === false);
      }
      setUsers(normalized);
      setTotalPages(payload.totalPages || 1);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to fetch users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter, departmentFilter, statusFilter, toast]);

  useEffect(() => { fetchUsers(); }, [roleFilter, departmentFilter, statusFilter, page, limit, search]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleAddUser = async (userData: any) => {
    try {
      const response = await api.post('/users', userData);
      const raw = response.data.user || response.data; // backend returns { user, tempPassword? }
      const mapped: User = {
        id: raw._id || raw.id,
        name: raw.name,
        email: raw.email,
        role: raw.role,
        isActive: raw.isActive,
        lastLogin: raw.lastLogin ? new Date(raw.lastLogin) : new Date(),
        assignedDevices: raw.assignedDevices || [],
        department: raw.department,
        accessLevel: raw.accessLevel || 'limited'
      };
      setUsers(prev => [mapped, ...prev]);
      toast({ title: 'User Added', description: `${userData.name} added successfully` });
      // Refetch to update pagination counts if needed
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to add user', variant: 'destructive' });
    }
  };

  const handleEditUser = async (userData: any) => {
    if (!editingUser) return;
    try {
      const response = await api.put(`/users/${editingUser.id}`, userData);
      const updated = response.data;
      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        id: updated._id || updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        lastLogin: updated.lastLogin ? new Date(updated.lastLogin) : new Date(),
        assignedDevices: updated.assignedDevices || [],
        department: updated.department,
        accessLevel: updated.accessLevel || 'limited'
      } : u));
      setEditingUser(null);
      toast({ title: 'User Updated', description: `${userData.name} updated successfully` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to update user', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.delete(`/users/${userId}`);
      // Immediately update local state for better UX
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: 'User Deleted', description: 'User removed successfully' });

      // Check if we need to adjust page after deletion
      const currentUsers = users.filter(u => u.id !== userId);
      if (currentUsers.length === 0 && page > 1) {
        setPage(p => p - 1);
      } else {
        // Refresh data from server to ensure consistency
        await fetchUsers();
      }
    } catch (error: any) {
      // If delete failed, refresh data to revert any optimistic updates
      await fetchUsers();
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete user', variant: 'destructive' });
    }
  };

  const toggleUserStatus = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      if (me && me === userId && user.isActive) {
        toast({ title: 'Action Blocked', description: 'You cannot deactivate your own account', variant: 'destructive' });
        return;
      }
      try {
        const response = await api.patch(`/users/${userId}/status`, { isActive: !user.isActive });
        const updated = response.data;
        setUsers(prev => prev.map(u => u.id === userId ? {
          id: updated._id || updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          isActive: updated.isActive,
          lastLogin: updated.lastLogin ? new Date(updated.lastLogin) : new Date(),
          assignedDevices: updated.assignedDevices || [],
          department: updated.department,
          accessLevel: updated.accessLevel || 'limited'
        } : u));
        toast({ title: 'Status Updated', description: `User ${updated.isActive ? 'activated' : 'deactivated'} successfully` });
        return;
      } catch (errPatch: any) {
        // If PATCH blocked by CORS or 405, fallback to POST
        if (!errPatch.response || [405, 404].includes(errPatch.response.status) || errPatch.message?.includes('Network')) {
          try {
            const response = await api.post(`/users/${userId}/status`, { isActive: !user.isActive });
            const updated = response.data;
            setUsers(prev => prev.map(u => u.id === userId ? {
              id: updated._id || updated.id,
              name: updated.name,
              email: updated.email,
              role: updated.role,
              isActive: updated.isActive,
              lastLogin: updated.lastLogin ? new Date(updated.lastLogin) : new Date(),
              assignedDevices: updated.assignedDevices || [],
              department: updated.department,
              accessLevel: updated.accessLevel || 'limited'
            } : u));
            toast({ title: 'Status Updated (Fallback)', description: `User ${updated.isActive ? 'activated' : 'deactivated'} successfully` });
            return;
          } catch (errPost: any) {
            throw errPost;
          }
        }
        throw errPatch;
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to update user status', variant: 'destructive' });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'manager': return <Shield className="w-4 h-4" />;
      case 'supervisor': return <Shield className="w-4 h-4" />;
      case 'technician': return <Wrench className="w-4 h-4" />;
      case 'operator': return <GraduationCap className="w-4 h-4" />;
      case 'security': return <ShieldCheck className="w-4 h-4" />;
      case 'user': return <User className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'manager': return 'default';
      case 'supervisor': return 'default';
      case 'technician': return 'default';
      case 'operator': return 'secondary';
      case 'security': return 'destructive';
      case 'user': return 'outline';
      default: return 'outline';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const formatLastLogin = (value: any) => {
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (!(date instanceof Date) || isNaN(date.getTime())) return '—';
      const now = Date.now();
      const diff = now - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return '—';
    }
  };

  return (
  <div className="space-y-6 max-w-full px-2 md:px-8 lg:px-16 xl:px-32">
      {/* Advanced Filters */}
      {/* CSV Import/Export & Customizable Columns */}
      {/* CSV Import/Export UI only; customizable columns removed as requested */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Button variant="outline" onClick={handleExportCSV}>Export CSV</Button>
        <label className="inline-block">
          <Button variant="outline" asChild>
            <span>Import CSV</span>
          </Button>
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="Search users..."
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(1); setSearch(e.target.value); }}
          className="w-48"
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border rounded px-2 py-1 bg-primary/10 text-primary focus:ring-2 focus:ring-primary">
          <option value="all" className="bg-background text-primary">All Roles</option>
          <option value="admin" className="bg-background text-primary">Admin</option>
          <option value="manager" className="bg-background text-primary">Manager</option>
          <option value="supervisor" className="bg-background text-primary">Supervisor</option>
          <option value="technician" className="bg-background text-primary">Technician</option>
          <option value="operator" className="bg-background text-primary">Operator</option>
          <option value="security" className="bg-background text-primary">Security</option>
          <option value="user" className="bg-background text-primary">General Staff</option>
        </select>
        <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="border rounded px-2 py-1 bg-primary/10 text-primary focus:ring-2 focus:ring-primary">
          {departmentOptions.map(opt => (
            <option key={opt} value={opt} className="bg-background text-primary">{opt === 'all' ? 'All Departments' : opt}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 bg-primary/10 text-primary focus:ring-2 focus:ring-primary">
          <option value="all" className="bg-background text-primary">All Status</option>
          <option value="active" className="bg-background text-primary">Active</option>
          <option value="inactive" className="bg-background text-primary">Inactive</option>
          <option value="pending" className="bg-background text-primary">Pending Approval</option>
        </select>
        <Button variant="outline" onClick={() => { setSearchInput(''); setSearch(''); setRoleFilter('all'); setDepartmentFilter('all'); setStatusFilter('all'); setPage(1); }} disabled={loading}>
          <RefreshCcw className="w-4 h-4 mr-1" /> Reset
        </Button>
        <Button variant="outline" onClick={fetchOnlineUsers} disabled={loading}>
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          Refresh Online
        </Button>
        <Button onClick={() => setDialogOpen(true)} disabled={loading}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUserIds.length > 0 && (
        <div className="flex gap-2 mb-4">
          <span className="font-medium">Bulk actions for {selectedUserIds.length} users:</span>
          <Button size="sm" variant="outline" onClick={() => {/* bulk activate logic */}}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => {/* bulk deactivate logic */}}>Deactivate</Button>
          <Button size="sm" variant="destructive" onClick={() => {/* bulk delete logic */}}>Delete</Button>
          <Button size="sm" variant="outline" onClick={() => {/* bulk assign role logic */}}>Assign Role</Button>
        </div>
      )}

      {loading && users.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">Loading users...</div>
      )}

      {!loading && users.length === 0 ? (
        <div className="text-center py-12">
          <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No users found</h3>
          <p className="text-muted-foreground mb-4">Add users to manage system access</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add First User
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <Card key={user.id} className={user.isActive ? '' : 'opacity-75'}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {visibleColumns.includes('name') && user.name}
                      {myRole === 'admin' && onlineUsers.has(user.id) && (
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Online"></span>
                      )}
                      {me === user.id && (
                        <Badge variant="outline" className="text-[10px]">You</Badge>
                      )}
                    </CardTitle>
                    {visibleColumns.includes('email') && (
                      <p className="text-sm text-muted-foreground truncate" title={user.email}>{user.email}</p>
                    )}
                    {visibleColumns.includes('department') && user.department && (
                      <p className="text-xs text-muted-foreground">Department: {user.department}</p>
                    )}
                    {/* Employee ID and Designation removed from card rendering as requested */}
                    {/* User Status Indicators */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {/* Removed Active/Inactive badge as requested */}
                      {visibleColumns.includes('isApproved') && user.isApproved === false && (
                        <Badge variant="secondary">Pending Approval</Badge>
                      )}
                      {visibleColumns.includes('lastSeen') && user.lastSeen && (
                        <span className="text-xs text-muted-foreground">Last seen: {new Date(user.lastSeen).toLocaleString()}</span>
                      )}
                      {visibleColumns.includes('registrationDate') && user.registrationDate && (
                        <span className="text-xs text-muted-foreground">Registered: {new Date(user.registrationDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    {/* Profile completeness indicator removed as requested */}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Role:</span>
                    <Badge variant={getRoleColor(user.role)} className="flex items-center gap-1 capitalize">
                      {getRoleIcon(user.role)} {user.role}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    {/* Online status badge removed as requested */}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Access:</span>
                    <Badge variant="outline" className="capitalize">{user.accessLevel}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Last Login:</span>
                    <span className="text-xs text-muted-foreground">{formatLastLogin(user.lastLogin)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Devices:</span>
                    <span className="text-xs text-muted-foreground">{user.assignedDevices.length}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditingUser(user); setDialogOpen(true); }}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant={user.isActive ? 'secondary' : 'default'} onClick={() => toggleUserStatus(user.id)} disabled={me === user.id && user.isActive}>
                      {user.isActive ? (me === user.id ? 'Self' : 'Deactivate') : 'Activate'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteId(user.id)} disabled={me === user.id}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    {/* Confirm Delete User Dialog */}
                    <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete User</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete this user? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={async () => {
                              await handleDeleteUser(confirmDeleteId);
                              setConfirmDeleteId(null);
                            }}
                          >
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">Page {page} of {totalPages}</div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => page > 1 && setPage(p => p - 1)} className={page === 1 ? 'pointer-events-none opacity-50' : ''} />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={() => page < totalPages && setPage(p => p + 1)} className={page === totalPages ? 'pointer-events-none opacity-50' : ''} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <UserDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingUser(null); }}
        onSave={editingUser ? handleEditUser : handleAddUser}
        user={editingUser}
      />
    </div>
  );
};

export default Users;
