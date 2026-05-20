import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Truck } from "lucide-react";

/** Decide where `/` should land based on the current user's role. */
const RoleRedirect = () => {
  const { user, role, loading } = useAuth();

  // Wait for both auth and role resolution so we never redirect to the
  // wrong portal on a momentary null role.
  if (loading || (user && role === null)) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex items-center gap-3 animate-fade-in">
          <Truck className="h-6 w-6 text-primary animate-pulse" />
          <span className="text-muted-foreground font-mono text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const isStaff = role === "admin" || role === "producer";
  return <Navigate to={isStaff ? "/staff" : "/client"} replace />;
};

export default RoleRedirect;