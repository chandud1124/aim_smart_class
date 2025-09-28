

import AnalyticsPage from "./pages/AnalyticsPage";
import AIMLPage from "./pages/AIMLPage";
import GrafanaPage from "./pages/GrafanaPage";
import PrometheusPage from "./pages/PrometheusPage";
import NoticeBoard from "./pages/NoticeBoard";

import { Home, Zap, Calendar, Users as UsersIcon, Settings as SettingsIcon, Bell, LogOut, Shield, UserCheck, User, Ticket, FileText, Activity, BarChart3, Server, Settings2, Brain, Monitor } from "lucide-react";
import Index from "./pages/Index";
import Devices from "./pages/Devices";
import Switches from "./pages/Switches";
import Master from "./pages/Master";
import Schedule from "./pages/Schedule";
import Users from "./pages/Users";
import PermissionManagement from "./pages/PermissionManagement";
import UserProfile from "./pages/UserProfile";
import Settings from "./pages/Settings";
import Tickets from "./pages/Tickets";
import NotFound from "./pages/NotFound";
import ActiveLogs from "./pages/ActiveLogs";
import SystemHealthPage from "./pages/SystemHealthPage";

export const navItems = [
  // ===== DASHBOARD =====
  {
    title: "Power Dashboard",
    to: "/",
    icon: <Home className="h-4 w-4" />,
    page: <Index />,
  },

  // ===== CORE OPERATIONS =====
  {
    title: "Devices",
    to: "/devices",
    icon: <Zap className="h-4 w-4" />,
    page: <Devices />,
  },
  {
    title: "Switches",
    to: "/switches",
    icon: <Zap className="h-4 w-4" />,
    page: <Switches />,
  },
  {
    title: "Master Control",
    to: "/master",
    icon: <Shield className="h-4 w-4" />,
    page: <Master />,
  },

  // ===== SCHEDULING =====
  {
    title: "Schedule",
    to: "/schedule",
    icon: <Calendar className="h-4 w-4" />,
    page: <Schedule />,
  },

  // ===== USER MANAGEMENT =====
  {
    title: "Users",
    to: "/users",
    icon: <UsersIcon className="h-4 w-4" />,
    page: <Users />,
  },
  {
    title: "Role Management",
    to: "/roles",
    icon: <Shield className="h-4 w-4" />,
    page: <PermissionManagement />,
  },
  {
    title: "Permissions",
    to: "/permissions",
    icon: <UserCheck className="h-4 w-4" />,
    page: <PermissionManagement />,
  },

  // ===== ANALYTICS & MONITORING =====
  {
    title: "Analytics & Monitoring",
    to: "/analytics",
    icon: <BarChart3 className="h-4 w-4" />,
    page: <AnalyticsPage />,
  },
  {
    title: "AI/ML Insights",
    to: "/aiml",
    icon: <Brain className="h-4 w-4" />,
    page: <AIMLPage />,
  },
  {
    title: "Grafana Analytics",
    to: "/grafana",
    icon: <BarChart3 className="h-4 w-4" />,
    page: <GrafanaPage />,
  },
  {
    title: "Prometheus Metrics",
    to: "/prometheus",
    icon: <Monitor className="h-4 w-4" />,
    page: <PrometheusPage />,
  },

  // ===== OPERATIONS & MAINTENANCE =====
  {
    title: "Notice Board",
    to: "/notices",
    icon: <FileText className="h-4 w-4" />,
    page: <NoticeBoard />,
  },
  {
    title: "System Health",
    to: "/system-health",
    icon: <Server className="h-4 w-4" />,
    page: <SystemHealthPage />,
  },

  // ===== SUPPORT & LOGS =====
  {
    title: "Support Tickets",
    to: "/tickets",
    icon: <Ticket className="h-4 w-4" />,
    page: <Tickets />,
  },
  {
    title: "Active Logs",
    to: "/logs",
    icon: <FileText className="h-4 w-4" />,
    page: <ActiveLogs />,
  },

  // ===== ACCOUNT & SETTINGS =====
  {
    title: "Profile",
    to: "/profile",
    icon: <User className="h-4 w-4" />,
    page: <UserProfile />,
  },
  {
    title: "Settings",
    to: "/settings",
    icon: <SettingsIcon className="h-4 w-4" />,
    page: <Settings />,
  },
];

// Additional nav items that might be used in header/sidebar
export const headerNavItems = [
  {
    title: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    action: "notifications",
  },
  {
    title: "Logout",
    icon: <LogOut className="h-4 w-4" />,
    action: "logout",
  },
];

// 404 page
export const notFoundPage = <NotFound />;
