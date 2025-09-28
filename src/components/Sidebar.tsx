
import React, { useState, useEffect } from 'react';
import {
  Home,
  Cpu,
  ToggleLeft,
  Calendar,
  Users,
  Settings,
  Shield,
  ChevronRight,
  ChevronLeft,
  Power,
  User,
  UserCheck,
  FileText,
  Activity,
  Brain,
  BarChart3,
  Monitor,
  Ticket,
  Settings2,
  Server
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useDevices } from '@/hooks/useDevices';
import { scheduleAPI } from '@/services/api';
import api from '@/services/api';
import { useGlobalLoading } from '@/hooks/useGlobalLoading';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';

const navigationSections = [
  {
    title: 'Dashboard',
    items: [
      { name: 'Power Dashboard', icon: Home, href: '/', current: false },
    ]
  },
  {
    title: 'Core Operations',
    items: [
      { name: 'Devices', icon: Cpu, href: '/devices', current: false, requiresPermission: 'canManageDevices' },
      { name: 'Switches', icon: ToggleLeft, href: '/switches', current: false, requiresPermission: 'canManageDevices' },
      { name: 'Master Control', icon: Power, href: '/master', current: false, requiresPermission: 'canManageDevices' },
    ]
  },
  {
    title: 'Scheduling',
    items: [
      { name: 'Schedule', icon: Calendar, href: '/schedule', current: false, requiresPermission: 'canManageSchedule' },
    ]
  },
  {
    title: 'User Management',
    items: [
      { name: 'Users', icon: Users, href: '/users', current: false, requiresPermission: 'canManageUsers' },
      { name: 'Role Management', icon: Shield, href: '/roles', current: false, requiresPermission: 'canManageUsers' },
      { name: 'Permissions', icon: UserCheck, href: '/permissions', current: false, requiresPermission: 'canApproveUsers' },
    ]
  },
  {
    title: 'Analytics & Monitoring',
    items: [
      { name: 'Analytics & Monitoring', icon: BarChart3, href: '/analytics', current: false, adminOnly: true },
      { name: 'AI/ML Insights', icon: Brain, href: '/aiml', current: false, adminOnly: true },
      { name: 'Grafana Analytics', icon: BarChart3, href: '/grafana', current: false, adminOnly: true },
      { name: 'Prometheus Metrics', icon: Monitor, href: '/prometheus', current: false, adminOnly: true },
    ]
  },
  {
    title: 'Operations & Maintenance',
    items: [
      { name: 'Notice Board', icon: FileText, href: '/notices', current: false },
      { name: 'System Health', icon: Server, href: '/system-health', current: false, adminOnly: true },
    ]
  },
  {
    title: 'Support & Logs',
    items: [
      { name: 'Support Tickets', icon: Ticket, href: '/tickets', current: false },
      { name: 'Active Logs', icon: FileText, href: '/logs', current: false, adminOnly: true },
    ]
  },
  {
    title: 'Account & Settings',
    items: [
      { name: 'Profile', icon: User, href: '/profile', current: false },
      { name: 'Settings', icon: Settings, href: '/settings', current: false },
    ]
  },
];

interface SidebarProps {
  className?: string;
  onNavigateClose?: () => void; // for mobile sheet close
}

export const Sidebar: React.FC<SidebarProps> = ({ className, onNavigateClose }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isAdmin, isSuperAdmin, hasManagementAccess } = usePermissions();
  const { refreshDevices } = useDevices();
  const { start, stop } = useGlobalLoading();
  const [navLock, setNavLock] = useState(false);
  const debounceRef = React.useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const deviceRelated = new Set(['/', '/devices', '/switches', '/master']);
  // Future: add schedule/users background prefetch similarly without blocking

  const handleNavigation = (href: string) => {
    if (navLock) return;
    setNavLock(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setNavLock(false), 400);
    if (deviceRelated.has(href)) {
      const token = start('nav');
      refreshDevices({ background: true }).finally(() => stop(token));
    }
    navigate(href);
    if (onNavigateClose) onNavigateClose();
  };

  return (
    <div className={cn(
      "glass flex flex-col transition-all duration-300 h-full relative z-20 min-w-16 box-border opacity-100 visible rounded-r-lg",
      collapsed ? "w-12 sm:w-16" : "w-48 sm:w-64",
      className
    )}>
      {/* Logo/Brand */}
      <div className="p-2 flex-shrink-0 h-16 relative z-10 glass">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg truncate">AutoVolt</h1>
              <p className="text-xs text-muted-foreground truncate">Power Management</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div
        className="flex-1 glass min-h-0 overflow-y-auto sidebar-scroll"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--muted)) transparent',
          maxHeight: 'calc(100vh - 8rem)'
        }}
      >
        <div className="p-2 space-y-2">
          {navigationSections.map((section, sectionIndex) => {
            // Filter items based on permissions
            const visibleItems = section.items.filter((item: any) => {
              if (item.adminOnly && !(isAdmin || isSuperAdmin)) {
                return false;
              }
              if (item.requiresPermission) {
                const perms = usePermissions();
                return perms[item.requiresPermission as keyof typeof perms];
              }
              return true;
            });

            // Skip section if no visible items
            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <div key={section.title} className="space-y-1">
                {/* Section Header */}
                {!collapsed && (
                  <div className="px-2 py-1 min-h-6">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                      {section.title}
                    </h3>
                  </div>
                )}

                {/* Section Items */}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isCurrentPage = location.pathname === item.href;

                    return (
                      <Button
                        key={item.name}
                        variant={isCurrentPage ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3 h-9 px-3 text-left overflow-hidden",
                          isCurrentPage && "bg-primary text-primary-foreground shadow-lg",
                          collapsed && "px-3 justify-center"
                        )}
                        onClick={() => handleNavigation(item.href)}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {!collapsed && <span className="text-sm truncate">{item.name}</span>}
                      </Button>
                    );
                  })}
                </div>

                {/* Section Divider (except for last section) */}
                {sectionIndex < navigationSections.length - 1 && (
                  <div className="mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapse Toggle */}
      <div className="p-2 flex-shrink-0 relative z-10 glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center h-8 hover:bg-primary/10 hover:text-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-0"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
