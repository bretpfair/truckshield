import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Truck } from "lucide-react";

const LoadingState = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="flex items-center gap-3 animate-fade-in">
      <Truck className="h-6 w-6 text-primary animate-pulse" />
      <span className="text-muted-foreground font-mono text-sm">Loading...</span>
    </div>
  </div>
);

/** Decide where `/` should land based on the current user's role. */
const RoleRedirect = () => {
  const { user, role, loading, signOut } = useAuth();
  const [roleWaitExpired, setRoleWaitExpired] = useState(false);

  useEffect(() => {
    if (!loading && user && role === null) {
      const timer = window.setTimeout(() => setRoleWaitExpired(true), 5000);
      return () => window.clearTimeout(timer);
    }
    setRoleWaitExpired(false);
  }, [loading, role, user]);

  // Wait for both auth and role resolution so we never redirect to the
  // wrong portal on a momentary null role.
  if (loading || (user && role === null && !roleWaitExpired)) {
    return <LoadingState />;
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (role === null) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="glass-panel max-w-md rounded-lg p-6 text-center space-y-4">
          <Truck className="h-8 w-8 text-primary mx-auto" />
          <div>
            <h1 className="text-lg font-semibold">Portal access is still being set up</h1>
            <p className="text-sm text-muted-foreground mt-2">
              We could not find a staff or client role for this signed-in account yet. Try your invite link again, or contact 360 Risk Partners if this keeps happening.
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  const isStaff = role === "admin" || role === "producer";
  return <Navigate to={isStaff ? "/staff" : "/client"} replace />;
};

export default RoleRedirect;
