import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "producer" | "client" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  loading: boolean;
  refreshRole: (userId?: string) => Promise<AppRole>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  refreshRole: async () => null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (userId: string): Promise<AppRole> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch user role:", error);
    }

    const nextRole = (data?.role as AppRole) ?? null;
    setRole(nextRole);
    return nextRole;
  }, []);

  const refreshRole = useCallback(async (userId?: string): Promise<AppRole> => {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data } = await supabase.auth.getUser();
      targetUserId = data.user?.id;
    }
    if (!targetUserId) return null;

    setLoading(true);
    try {
      return await fetchRole(targetUserId);
    } finally {
      setLoading(false);
    }
  }, [fetchRole]);

  const trackLogin = async (userId: string) => {
    // Insert into login_history
    await supabase.from("login_history" as any).insert({
      user_id: userId,
      user_agent: navigator.userAgent,
    } as any);
    // Update last_login_at on profile
    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() } as any)
      .eq("user_id", userId);

    // Track client logins in activity_log
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("client_user_id", userId)
      .maybeSingle();

    if (account) {
      // Check if this is the first login by looking for any prior client_login entry
      const { data: priorLogins } = await supabase
        .from("activity_log")
        .select("id")
        .eq("account_id", account.id)
        .eq("action_type", "client_login")
        .limit(1);

      const isFirstLogin = !priorLogins || priorLogins.length === 0;

      await supabase.from("activity_log").insert({
        account_id: account.id,
        user_id: userId,
        action_type: "client_login",
        description: isFirstLogin
          ? "Client signed into the portal for the first time"
          : "Client signed into the portal",
      });

      // Send first-login-welcome email + in-app notification on first login
      if (isFirstLogin) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("user_id", userId)
            .maybeSingle();

          const { data: acctDetails } = await supabase
            .from("accounts")
            .select("contact_email, company_name")
            .eq("id", account.id)
            .single();

          const recipientEmail = profile?.email || acctDetails?.contact_email;
          if (recipientEmail) {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "first-login-welcome",
                recipientEmail,
                accountId: account.id,
                idempotencyKey: `first-login-welcome-${account.id}`,
                templateData: {
                  firstName: profile?.full_name?.split(" ")[0] || undefined,
                  portalLink: "https://truckshield.360riskpartners.com/client",
                },
              },
            });
          }
        } catch {
          // Non-fatal
        }
      }
    }
  };

  useEffect(() => {
    // Restore session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Then subscribe to changes — never await inside the callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Keep loading=true until role is fetched so consumers (RoleRedirect,
          // AppLayout) don't make routing decisions with a stale/null role.
          setLoading(true);
          fetchRole(session.user.id).finally(() => setLoading(false));
          if (_event === "SIGNED_IN") {
            trackLogin(session.user.id);
          }
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, refreshRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
