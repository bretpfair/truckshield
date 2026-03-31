import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import StaffDashboard from "@/pages/StaffDashboard";
import ClientPortal from "@/pages/ClientPortal";
import ClientPortalForAccount from "@/pages/ClientPortalForAccount";
import { Truck, LogOut, User, Eye } from "lucide-react";
import sitelogo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import MessagingSidebar from "@/components/messaging/MessagingSidebar";
import useRealtimeUpdates from "@/hooks/useRealtimeUpdates";

const AppLayout = () => {
  const { user, role, loading, signOut } = useAuth();
  const [viewAsClient, setViewAsClient] = useState(false);
  const [previewAccountId, setPreviewAccountId] = useState<string | null>(null);
  const [staffNavigateAccountId, setStaffNavigateAccountId] = useState<string | null>(null);
  const [messagingExpanded, setMessagingExpanded] = useState(false);
  const [messagingAccountId, setMessagingAccountId] = useState<string | null>(null);
  useRealtimeUpdates(user?.id);

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

  const isStaffRole = role === "admin" || role === "producer";
  const showClient = !isStaffRole || viewAsClient;

  const handlePreviewClient = (accountId?: string) => {
    setPreviewAccountId(accountId || null);
    setViewAsClient(true);
  };

  const handleBackToStaff = () => {
    setViewAsClient(false);
    setPreviewAccountId(null);
  };

  const handleOpenMessages = (accountId: string) => {
    setMessagingAccountId(accountId);
    setMessagingExpanded(true);
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
              {showClient ? "Client" : "Staff"}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {isStaffRole && (
              <Button
                variant={viewAsClient ? "default" : "outline"}
                size="sm"
                onClick={() => viewAsClient ? handleBackToStaff() : handlePreviewClient()}
                className="gap-1 text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
              >
                <Eye className="h-3 w-3" />
                <span className="hidden xs:inline">{viewAsClient ? "Back to Staff" : "Preview Client"}</span>
              </Button>
            )}
            <NotificationBell
              onNavigateToAccount={(accountId) => {
                if (isStaffRole) {
                  setViewAsClient(false);
                  setPreviewAccountId(null);
                  setStaffNavigateAccountId(accountId);
                }
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
        <main className={`flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6 transition-all duration-300 ${isStaffRole && !showClient && messagingExpanded ? "md:mr-[380px]" : isStaffRole && !showClient ? "md:mr-12" : ""}`}>
          {showClient ? (
            previewAccountId ? (
              <ClientPortalForAccount accountId={previewAccountId} />
            ) : (
              <ClientPortal />
            )
          ) : (
            <StaffDashboard
              onPreviewClient={handlePreviewClient}
              onOpenMessages={handleOpenMessages}
              navigateToAccountId={staffNavigateAccountId}
              onNavigateHandled={() => setStaffNavigateAccountId(null)}
            />
          )}
        </main>

        {isStaffRole && !showClient && (
          <MessagingSidebar
            expanded={messagingExpanded}
            onToggle={() => setMessagingExpanded((prev) => !prev)}
            accountId={messagingAccountId}
            isStaff
          />
        )}
      </div>
    </div>
  );
};

export default AppLayout;
