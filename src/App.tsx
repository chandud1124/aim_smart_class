import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Layout } from "@/components/Layout";
import { PrivateRoute } from "./components/PrivateRoute";
import { AuthProvider } from '@/context/AuthContext';
import { GlobalLoadingProvider } from '@/hooks/useGlobalLoading';
import { GlobalLoadingOverlay } from '@/components/GlobalLoadingOverlay';
import { DevicesProvider } from '@/hooks/useDevices';
import { SocketProvider } from '@/context/SocketContext';

// Lazy load components for better performance
const Index = lazy(() => import("./pages/Index"));
const Devices = lazy(() => import("./pages/Devices"));
const Switches = lazy(() => import("./pages/Switches"));
const Master = lazy(() => import("./pages/Master"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Register = lazy(() => import("./pages/Register"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile").then(module => ({ default: module.Profile })));
const PermissionManagement = lazy(() => import("./pages/PermissionManagement"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));
const ActiveLogs = lazy(() => import("./pages/ActiveLogs"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/ResetPassword"));
const Tickets = lazy(() => import("./pages/Tickets"));
// New feature pages
const SystemHealthPage = lazy(() => import("./pages/SystemHealthPage"));
const AIMLPage = lazy(() => import("./pages/AIMLPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const GrafanaPage = lazy(() => import("./pages/GrafanaPage"));
const PrometheusPage = lazy(() => import("./pages/PrometheusPage"));
const NoticeBoard = lazy(() => import("./pages/NoticeBoard"));
const SocketTest = lazy(() => import("./components/SocketTest"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <GlobalLoadingProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true
              }}>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/register" element={<Register />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:resetToken" element={<ResetPassword />} />

                    {/* Protected Routes */}
                    <Route
                      path="/"
                      element={
                        <PrivateRoute>
                          <DevicesProvider>
                            <Layout />
                          </DevicesProvider>
                        </PrivateRoute>
                      }
                    >
                      <Route index element={<Index />} />
                      <Route path="devices" element={<Devices />} />
                      <Route path="switches" element={<Switches />} />
                      <Route path="master" element={<Master />} />
                      <Route path="schedule" element={<Schedule />} />
                      <Route path="users" element={<Users />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="profile" element={<UserProfile />} />
                      <Route path="permissions" element={<PermissionManagement />} />
                      <Route path="roles" element={<RoleManagement />} />
                      <Route path="logs" element={<PrivateRoute><ActiveLogs /></PrivateRoute>} />
                      <Route path="system-health" element={<SystemHealthPage />} />
                      <Route path="tickets" element={<Tickets />} />
                      <Route path="aiml" element={<AIMLPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="grafana" element={<GrafanaPage />} />
                      <Route path="prometheus" element={<PrometheusPage />} />
                      <Route path="notices" element={<NoticeBoard />} />
                      <Route path="socket-test" element={<SocketTest />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
              <GlobalLoadingOverlay />
            </TooltipProvider>
          </GlobalLoadingProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};export default App;
