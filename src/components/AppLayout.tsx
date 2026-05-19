import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Outlet, useLocation, useNavigate, matchPath } from "react-router-dom";
import { Truck, LogOut, User, Eye } from "lucide-react";
import sitelogo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import MessagingSidebar from "@/components/messaging/MessagingSidebar";
import useRealtimeUpdates from "@/hooks/useRealtimeUpdates";

/** Pull :accountId out of the current path regardless of which nested route matched. */
const useRouteAccountId = (): string | null => {
  const { pathname } = useLocation();
  for (const pattern of [
    "/staff/accounts/:accountId/application",
    "/staff/accounts/:accountId",
    "/staff/preview/:accountId",
  ]) {
    const m = matchPath({ path: pattern, end: true }, pathname);
    if (m?.params?.accountId) return m.params.accountId;
  }
  return null;
};

const AppLayout = () => {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [messagingExpanded, setMessagingExpanded] = useState(false);
  const [clientMessagingAccountId, setClientMessagingAccountId] = useState<string | null>(null);
  useRealtimeUpdates(user?.id);

  const isStaffRole = role === "admin" || role === "producer";
  const onClientArea =
    location.pathname.startsWith("/client") ||
    location.pathname.startsWith("/staff/preview");
  const inStaffPreview = location.pathname.startsWith("/staff/preview");
  const routeAccountId = useRouteAccountId();

  // Messaging sidebar account: staff = current account in URL, client = their own account (set by ClientPortal via custom event)
  const messagingAccountId = isStaffRole ? routeAccountId : clientMessagingAccountId;

  // Listen for the client portal to publish its account id
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) setClientMessagingAccountId(id);
    };
    window.addEventListener("client-account-ready", handler as EventListener);
    return () => window.removeEventListener("client-account-ready", handler as EventListener);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 animate-fade-in">
          <Truck className="h-6 w-6 text-primary animate-pulse" />
          <span className="text-muted-foreground font-mono text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const handleTogglePreview = () => {
    if (inStaffPreview) {
      navigate("/staff");
    } else {
      // Preview from current account if we're on one, otherwise generic /client
      if (routeAccountId) navigate(`/staff/preview/${routeAccountId}`);
      else navigate("/client");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-2 sm:px-4 gap-1 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <img src={sitelogo} alt="TruckShield" className="h-7 sm:h-8 w-auto shrink-0 rounded" />
            <span className="font-bold text-foreground text-xs sm:text-sm truncate">
              <span className="sm:hidden">TruckShield</span>
              <span className="hidden sm:inline">TruckShield, powered by 360 Risk Partners</span>
            </span>
            <span className="status-badge bg-primary/10 text-primary rounded text-[10px] sm:text-xs shrink-0">
              {onClientArea ? "Client" : "Staff"}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {isStaffRole && (
              <Button
                variant={inStaffPreview ? "default" : "outline"}
                size="sm"
                onClick={handleTogglePreview}
                className="gap-1 text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
              >
                <Eye className="h-3 w-3" />
                <span className="hidden xs:inline">{inStaffPreview ? "Back to Staff" : "Preview Client"}</span>
              </Button>
            )}
            <NotificationBell
              onNavigateToAccount={(accountId) => {
                if (isStaffRole) navigate(`/staff/accounts/${accountId}`);
              }}
            />
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className={`flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6 transition-all duration-300 ${messagingExpanded ? "md:mr-[380px]" : "md:mr-12"}`}>
          <Outlet />
        </main>

        <MessagingSidebar
          expanded={messagingExpanded}
          onToggle={() => setMessagingExpanded((prev) => !prev)}
          accountId={messagingAccountId}
          isStaff={isStaffRole && !inStaffPreview}
        />
      </div>
    </div>
  );
};

export default AppLayout;
