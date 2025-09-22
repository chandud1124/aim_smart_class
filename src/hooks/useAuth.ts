
import { useState, useEffect, useRef } from 'react';
import { authAPI } from '@/services/api';
import { socketService } from '@/services/socket';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  designation?: string;
  employeeId?: string;
  accessLevel: string;
  assignedDevices: string[];
  profilePicture?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user_data');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('auth_token');
  });

  const { toast } = useToast();

  // Debounce auth check to avoid duplicate rapid mounts
  const authCheckScheduled = useRef(false);
  useEffect(() => {
    if (!authCheckScheduled.current) {
      authCheckScheduled.current = true;
      setTimeout(() => {
        checkAuthStatus();
      }, 50);
    }
  }, []);

  // Listen for real-time user profile updates
  useEffect(() => {
    console.log('[Auth] Setting up real-time event listeners');

    const handleUserProfileUpdated = (data: any) => {
      console.log('[Auth] 📨 Received user_profile_updated event:', data);
      toast({
        title: "Profile Updated",
        description: data.message || "Your profile has been updated by an administrator.",
        duration: 5000,
      });
      // Refresh user data from server
      console.log('[Auth] 🔄 Refreshing user profile after update event');
      checkAuthStatus();
    };

    const handleUserRoleChanged = (data: any) => {
      console.log('[Auth] 📨 Received user_role_changed event:', data);
      toast({
        title: "Role Changed",
        description: data.message || `Your role has been changed.`,
        variant: "destructive",
        duration: 8000,
      });
      // Force a full refresh of authentication state
      console.log('[Auth] 🔄 Refreshing user profile after role change event');
      checkAuthStatus();
    };

    // Register event listeners
    console.log('[Auth] Registering socket event listeners');
    socketService.on('user_profile_updated', handleUserProfileUpdated);
    socketService.on('user_role_changed', handleUserRoleChanged);

    return () => {
      console.log('[Auth] Cleaning up socket event listeners');
      // Cleanup event listeners
      socketService.off('user_profile_updated', handleUserProfileUpdated);
      socketService.off('user_role_changed', handleUserRoleChanged);
    };
  }, [toast]);

  const checkAuthStatus = async () => {
    if ((window as any).__authProfileInFlight) return; // simple client guard
    (window as any).__authProfileInFlight = true;
    try {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setLoading(false);
        setIsAuthenticated(false);
        return;
      }

      try {
        // Verify token with backend by fetching the user profile
        const response = await authAPI.getProfile();
        const userData = response.data.user;

        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        // If token verification fails, clear storage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
      (window as any).__authProfileInFlight = false;
    }
  };

  const login = (userData: User, token: string) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateProfile = async (data: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
    delete?: boolean;
  }) => {
    try {
      if (data.delete) {
        await authAPI.deleteAccount();
        logout();
        return;
      }

      const response = await authAPI.updateProfile(data);
      const updatedUser = response.data.user;
      setUser(updatedUser);
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      throw error;
    }
  };

  return {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateProfile,
    refreshProfile: checkAuthStatus // Expose refresh function for manual updates
  };
};
