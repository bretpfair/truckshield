import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import StaffDashboard from "@/pages/StaffDashboard";
import ClientPortal from "@/pages/ClientPortal";
import ClientPortalForAccount from "@/pages/ClientPortalForAccount";
import { Truck, LogOut, User, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import MessagingSidebar from "@/components/messaging/MessagingSidebar";
import NotificationBell from "@/components/NotificationBell";

const AppLayout = () => {
  const { user, role, loading, signOut } = useAuth();
  const [viewAsClient, setViewAsClient] = useState(false);
  const [previewAccountId, setPreviewAccountId] = useState<string | null>(null);
  const [messagingExpanded, setMessagingExpanded] = useState(true);
  const [messagingAccountId, setMessagingAccountId] = useState<string | null>(null);

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

  const showClient = role !== "admin" || viewAsClient;
  const isStaff = role === "admin" && !viewAsClient;

  const handlePreviewClient = (accountId?: string) => {
    setPreviewAccountId(accountId || null);
    setViewAsClient(true);
  };

  const handleBackToStaff = () => {
    setViewAsClient(false);
    setPreviewAccountId(null);
  };

  const activeAccountId = messagingAccountId || previewAccountId;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">TruckShield</span>
            <span className="status-badge bg-primary/10 text-primary rounded">
              {showClient ? "Client" : "Staff"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {role === "admin" && (
              <Button
                variant={viewAsClient ? "default" : "outline"}
                size="sm"
                onClick={() => viewAsClient ? handleBackToStaff() : handlePreviewClient()}
                className="gap-1.5 text-xs"
              >
                <Eye className="h-3 w-3" />
                {viewAsClient ? "Back to Staff" : "Preview Client"}
              </Button>
            )}
            <NotificationBell
              onNavigateToAccount={(accountId) => {
                if (role === "admin") {
                  setViewAsClient(false);
                  setPreviewAccountId(null);
                }
                setMessagingAccountId(accountId);
              }}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-6">
          {showClient ? (
            previewAccountId ? (
              <ClientPortalForAccount accountId={previewAccountId} />
            ) : (
              <ClientPortal onSetMessagingAccount={(id) => setMessagingAccountId(id)} />
            )
          ) : (
            <StaffDashboard
              onPreviewClient={handlePreviewClient}
              onOpenMessages={(accountId) => { setMessagingAccountId(accountId); setMessagingExpanded(true); }}
            />
          )}
        </main>

        <MessagingSidebar
          expanded={messagingExpanded}
          onToggle={() => setMessagingExpanded(!messagingExpanded)}
          accountId={activeAccountId}
          isStaff={isStaff}
        />
      </div>
    </div>
  );
};

export default AppLayout;
