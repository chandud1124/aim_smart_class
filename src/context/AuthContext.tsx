import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { authAPI } from '../services/api';
import socketService from '../services/socket';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
  updateProfile: (data: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
    delete?: boolean;
  }) => Promise<any>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Set up socket event listeners once at the app level
  useEffect(() => {
    const handleUserProfileUpdated = (data: any) => {
      console.log('[AuthProvider] 📨 Received user_profile_updated event:', data);
      toast({
        title: "Profile Updated",
        description: data.message || "Your profile has been updated by an administrator.",
        duration: 5000,
      });
      // Refresh user data from server
      checkAuthStatus();
    };

    const handleUserRoleChanged = (data: any) => {
      console.log('[AuthProvider] 📨 Received user_role_changed event:', data);
      toast({
        title: "Role Changed",
        description: data.message || `Your role has been changed.`,
        variant: "destructive",
        duration: 8000,
      });
      // Force a full refresh of authentication state
      checkAuthStatus();
    };

    // Register event listeners once at app level
    socketService.on('user_profile_updated', handleUserProfileUpdated);
    socketService.on('user_role_changed', handleUserRoleChanged);

    return () => {
      // Cleanup event listeners on unmount
      socketService.off('user_profile_updated', handleUserProfileUpdated);
      socketService.off('user_role_changed', handleUserRoleChanged);
    };
  }, []);

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

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateProfile,
    refreshProfile: checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}