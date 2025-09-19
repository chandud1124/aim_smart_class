import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, User, Wifi, WifiOff, Settings, LogOut, Home, Menu } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useDevices } from '@/hooks/useDevices';
import { useSecurityNotifications } from '@/hooks/useSecurityNotifications';
import { navItems } from '@/nav-items';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { devices } = useDevices();
  const { alerts: notifications } = useSecurityNotifications();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const currentPage = navItems.find(item => item.to === location.pathname) || navItems[0];
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const notifRef = useRef(null);
  const userRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const sidebarRef = useRef(null);
  
  // Global click handler ref
  const isDropdownOpen = showNotifications || showUserMenu || showMobileMenu || showSidebar;

  const connectedDevices = devices.filter(device => device.status === 'online').length;
  const isConnected = connectedDevices > 0;

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) setShowUserMenu(false);
  };
  
  const handleUserClick = () => {
    setShowUserMenu(!showUserMenu);
    if (!showUserMenu) setShowNotifications(false);
  };
  
  const closeAll = () => {
    setShowNotifications(false);
    setShowUserMenu(false);
    setShowSidebar(false);
  };

  const handleRefresh = () => {
    toast({
      title: "Refreshing connection status",
      description: "Checking device connectivity..."
    });
    window.location.reload();
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only process if at least one dropdown is open
      if (isDropdownOpen) {
        // Check if click is outside all dropdown areas
        const isOutsideAll = (
          (!notifRef.current || !notifRef.current.contains(event.target)) &&
          (!userRef.current || !userRef.current.contains(event.target)) &&
          (!mobileMenuRef.current || !mobileMenuRef.current.contains(event.target))
        );
        
        // If click is outside all dropdowns, close them all
        if (isOutsideAll) {
          closeAll();
          setShowMobileMenu(false);
        }
      }
    };
    
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeAll();
        setShowMobileMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDropdownOpen]);

  return (
    <header className="border-b px-4 py-3 relative z-50 flex items-center justify-between">
      {/* Left side */}
      <div className="flex items-center gap-2">
        {isMobile && (
          <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-1" onClick={() => setShowSidebar(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0" ref={sidebarRef}>
              <Sidebar onNavigateClose={() => {
                setShowSidebar(false);
              }} />
            </SheetContent>
          </Sheet>
        )}
        <div className={cn(isMobile && "max-w-[200px]", "overflow-hidden")}>
          <div className="flex items-center gap-3 mb-1">
            <img src="/logo.png" alt="AutoVolt Logo" className="h-8 w-auto" />
            <h1 className="font-bold truncate">{currentPage.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground truncate">{currentPage.description}</p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Connection status */}
        <Button variant="ghost" size="icon" onClick={handleRefresh}>
          {isConnected ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
        </Button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBellClick}
          >
            <Bell className="h-5 w-5" />
            {notifications.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center">
                {notifications.length}
              </Badge>
            )}
          </Button>

          {showNotifications && (
            <Card className={cn(
              "absolute shadow-lg z-50",
              isMobile 
                ? "right-2 mt-2 w-[calc(100vw-4rem)] max-w-[360px]" 
                : "right-0 mt-2 w-80"
            )}>
              <CardHeader>
                <CardTitle className="text-sm">Notifications</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  {notifications.length > 0 ? (
                    <div className="flex flex-col">
                      {notifications.map((notification, index) => (
                        <button
                          key={index}
                          className="flex items-start gap-2 p-3 text-left hover:bg-accent border-b last:border-0"
                          onClick={() => {
                            closeAll();
                            navigate(`/alerts/${notification.id}`);
                          }}
                        >
                          <div className="flex-1 space-y-1">
                            <p className="text-xs font-medium">{notification.title}</p>
                            <p className="text-xs text-muted-foreground">{notification.message}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center">
                      <Bell className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm font-medium">No notifications</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={userRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUserClick}
          >
            <User className="h-5 w-5" />
          </Button>

          {showUserMenu && (
            <Card className={cn(
              "absolute shadow-lg z-50",
              isMobile 
                ? "right-2 mt-2 w-[calc(100vw-4rem)] max-w-[360px]" 
                : "right-0 mt-2 w-80"
            )}>
              <CardHeader className="py-3 px-4">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || 'user@example.com'}</p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => { closeAll(); navigate('/'); }}
                >
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => { closeAll(); navigate('/settings'); }}
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                  onClick={() => {
                    closeAll();
                    localStorage.clear();
                    navigate('/login');
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {(showNotifications || showUserMenu) && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-40" 
          onClick={closeAll}
        />
      )}
    </header>
  );
}
