
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useDevices } from '@/hooks/useDevices';
import { useToast } from '@/hooks/use-toast';

export interface UserData {
  name: string;
  email: string;
  role: 'super-admin' | 'dean' | 'admin' | 'faculty' | 'teacher' | 'student' | 'security' | 'guest';
  assignedDevices: string[];
  department?: string;
  employeeId?: string;
  designation?: string;
  phone?: string;
  assignedRooms: string[];
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (user: UserData) => void;
  user?: any;
}

export const UserDialog: React.FC<UserDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  user
}) => {
  const { devices } = useDevices();
  const { toast } = useToast();

  const [formData, setFormData] = useState<UserData>({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'student',
    assignedDevices: user?.assignedDevices || [],
    department: user?.department || '',
    employeeId: user?.employeeId || '',
    designation: user?.designation || '',
    phone: user?.phone || '',
    assignedRooms: user?.assignedRooms || []
  });

  // Keep form in sync when switching between add/edit or reopening dialog
  useEffect(() => {
    if (open) {
      if (user) {
        setFormData({
          name: user.name || '',
          email: user.email || '',
          role: user.role || 'student',
          assignedDevices: user.assignedDevices || [],
          department: user.department || '',
          employeeId: user.employeeId || '',
          designation: user.designation || '',
          phone: user.phone || '',
          assignedRooms: user.assignedRooms || []
        });
      } else {
        setFormData({
          name: '',
          email: '',
          role: 'student',
          assignedDevices: [],
          department: '',
          employeeId: '',
          designation: '',
          phone: '',
          assignedRooms: []
        });
      }
    }
  }, [open, user]);

  const handleDeviceToggle = (deviceId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({ ...prev, assignedDevices: [...prev.assignedDevices, deviceId] }));
    } else {
      setFormData(prev => ({ ...prev, assignedDevices: prev.assignedDevices.filter(d => d !== deviceId) }));
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.email) {
      toast({
        title: "Validation Error",
        description: "Please fill in name and email",
        variant: "destructive"
      });
      return;
    }

    onSave(formData);
    onOpenChange(false);

    // Reset form for new users
    if (!user) {
      setFormData({
        name: '',
        email: '',
        role: 'student',
        assignedDevices: [],
        department: '',
        employeeId: '',
        designation: '',
        phone: '',
        assignedRooms: []
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {user ? 'Edit User' : 'Add New User'}
          </DialogTitle>
          <DialogDescription>
            {user ? 'Update user information and permissions.' : 'Create a new user account with appropriate permissions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@college.edu"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as any }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super-admin">Super Administrator</SelectItem>
                  <SelectItem value="dean">Dean</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="faculty">Faculty</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="security">Security Personnel</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="Computer Science"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input
                id="employeeId"
                value={formData.employeeId}
                onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                placeholder="EMP12345"
              />
            </div>
            <div>
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={formData.designation}
                onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                placeholder="Lecturer, Security, etc."
              />
            </div>
          </div>
          {/* Phone number field removed from profile UI */}

          <div>
            <Label>Assigned Devices/Classrooms</Label>
            <div className="max-h-32 overflow-y-auto border rounded p-3 mt-2 space-y-2">
              {devices.map(device => (
                <div key={device.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={device.id}
                    checked={formData.assignedDevices.includes(device.id)}
                    onCheckedChange={(checked) => handleDeviceToggle(device.id, checked as boolean)}
                  />
                  <Label htmlFor={device.id} className="text-sm flex-1">
                    {device.name}
                    <span className="text-muted-foreground ml-2">({device.location})</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {user ? 'Update User' : 'Add User'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
