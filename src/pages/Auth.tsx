import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Mail, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import sitelogo from "@/assets/logo.png";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const staffInviteToken = searchParams.get("staff_invite");
  const mode = searchParams.get("mode");
  const { toast } = useToast();
  const { refreshRole, session: authSession } = useAuth();

  const isStaffFlow = !!(staffInviteToken || mode === "staff");
  const [isLogin, setIsLogin] = useState(true);
  const [staffUseMagicLink, setStaffUseMagicLink] = useState(false);
  const [staffMagicLinkSent, setStaffMagicLinkSent] = useState(false);

  // Invite token state
  const [inviteStatus, setInviteStatus] = useState<
    "loading" | "valid" | "link_expired" | "invite_expired" | "invalid" | "accepted" | null
  >(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [resendingLink, setResendingLink] = useState(false);
  const acceptingInviteRef = useRef(false);
  const inviteProcessedRef = useRef<string | null>(null);

  const authHashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const authErrorCode = authHashParams.get("error_code");
  const authErrorDescription = authHashParams.get("error_description");
  const authLinkExpired = !!inviteToken && (
    authErrorCode === "otp_expired" ||
    /expired|invalid/i.test(authErrorDescription || "")
  );

  useEffect(() => {
    if (staffInviteToken) setIsLogin(false);
  }, [staffInviteToken]);

  // Fetch invite details when invite token is present
  useEffect(() => {
    if (!inviteToken || isStaffFlow) return;

    const fetchInviteDetails = async () => {
      setInviteStatus("loading");
      try {
        const { data, error } = await supabase.rpc(
          "get_client_invitation_status" as any,
          { p_token: inviteToken },
        );

        if (error || !data || typeof data !== "object") {
          setInviteStatus("invalid");
          return;
        }

        const result = data as { status: string; email?: string };
        if (result.email) {
          setInviteEmail(result.email);
          setEmail(result.email);
        }

        if (authLinkExpired && result.status === "valid") {
          setInviteStatus("link_expired");
        } else if (result.status === "valid") {
          setInviteStatus("valid");
        } else if (result.status === "expired") {
          setInviteStatus("invite_expired");
        } else if (result.status === "accepted") {
          setInviteStatus("accepted");
        } else {
          setInviteStatus("invalid");
        }
      } catch {
        setInviteStatus("invalid");
      }
    };

    fetchInviteDetails();
  }, [inviteToken, isStaffFlow, authLinkExpired]);

  // Accept staff invitation helper
  const acceptStaffInvitation = async () => {
    if (!staffInviteToken) return;
    try {
      const { data, error } = await supabase.rpc("accept_staff_invitation", { p_token: staffInviteToken });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in (data as any)) {
        toast({ title: "Invitation issue", description: (data as any).error, variant: "destructive" });
      } else {
        toast({ title: "Welcome to the team!", description: "You now have staff access." });
      }
    } catch (err: any) {
      console.error("Staff invite acceptance error:", err);
    }
  };

  // Accept client invitation helper
  const acceptInvitation = async (): Promise<{ ok: boolean }> => {
    if (!inviteToken) return { ok: true };
    try {
      const { data, error } = await supabase.rpc("accept_invitation", { p_token: inviteToken });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in (data as any)) {
        const msg = (data as any).error as string;
        toast({ title: "Invitation issue", description: msg, variant: "destructive" });
        if (/expired/i.test(msg)) setInviteStatus("invite_expired");
        else if (/accepted|already/i.test(msg)) setInviteStatus("accepted");
        else setInviteStatus("invalid");
        return { ok: false };
      } else {
        toast({ title: "Welcome!", description: "Your account has been linked." });
        return { ok: true };
      }
    } catch (err: any) {
      console.error("Invite acceptance error:", err);
      setInviteStatus("invalid");
      return { ok: false };
    }
  };

  // React to current auth session (covers both initial restore and the
  // onAuthStateChange events that fire after Supabase processes a magic-link
  // redirect). Guard against double-processing the same invite token.
  useEffect(() => {
    if (!authSession) return;
    const userId = authSession.user.id;

    const run = async () => {
      if (inviteToken && !isStaffFlow) {
        if (inviteProcessedRef.current === inviteToken || acceptingInviteRef.current) return;
        acceptingInviteRef.current = true;
        try {
          const result = await acceptInvitation().catch(() => ({ ok: false }));
          inviteProcessedRef.current = inviteToken;
          if (!result.ok) return; // stay on /auth so the user sees the banner
          await refreshRole(userId);
          navigate("/client", { replace: true });
        } finally {
          acceptingInviteRef.current = false;
        }
        return;
      }

      if (staffInviteToken) {
        if (inviteProcessedRef.current === staffInviteToken) return;
        inviteProcessedRef.current = staffInviteToken;
        await acceptStaffInvitation();
        await refreshRole(userId);
        navigate("/", { replace: true });
        return;
      }

      navigate("/", { replace: true });
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession, inviteToken, staffInviteToken, isStaffFlow]);

  // Resend magic link for expired invite tokens
  const handleResendInviteLink = async () => {
    if (!inviteEmail) return;
    setResendingLink(true);
    const redirectTo = `${window.location.origin}/auth?invite=${inviteToken}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setMagicLinkSent(true);
      toast({ title: "Check your email", description: "We sent you a new access link." });
    }
    setResendingLink(false);
  };

  // --- STAFF: password-based login/signup ---
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        if (staffInviteToken) {
          await acceptStaffInvitation();
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) await refreshRole(userData.user.id);
        }
        navigate("/");
      }
    } else {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin + (
            staffInviteToken ? `/auth?staff_invite=${staffInviteToken}` : ""
          ),
        },
      });
      if (error) {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      } else {
        if (signUpData.session) {
          if (staffInviteToken) {
            await acceptStaffInvitation();
            await refreshRole(signUpData.session.user.id);
          }
          navigate("/");
        } else {
          toast({ title: "Account created", description: "Check your email to verify your account." });
        }
      }
    }
    setLoading(false);
  };

  // --- STAFF: magic link ---
  const handleStaffMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectTo = staffInviteToken
      ? `${window.location.origin}/auth?staff_invite=${staffInviteToken}&mode=staff`
      : `${window.location.origin}/auth?mode=staff`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setStaffMagicLinkSent(true);
      toast({ title: "Check your email", description: "We sent you a magic link to sign in." });
    }
    setLoading(false);
  };

  // --- CLIENT: magic link ---
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectTo = inviteToken
      ? `${window.location.origin}/auth?invite=${inviteToken}`
      : `${window.location.origin}/auth`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setMagicLinkSent(true);
      toast({ title: "Check your email", description: "We sent you a magic link to sign in." });
    }
    setLoading(false);
  };

  // Render client invite status banners
  const renderInviteBanner = () => {
    if (!inviteToken || isStaffFlow) return null;

    if (inviteStatus === "loading") {
      return (
        <div className="mb-4 p-3 rounded-md bg-muted border border-border text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verifying your invitation...
        </div>
      );
    }

    if (inviteStatus === "invalid") {
      return (
        <div className="mb-4 p-4 rounded-md bg-destructive/10 border border-destructive/20 text-sm space-y-2">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertCircle className="h-4 w-4" />
            Invalid invitation
          </div>
          <p className="text-muted-foreground">
            We couldn't find this invitation. Please contact your agent to request a new one — the same link can't be reused.
          </p>
        </div>
      );
    }

    if (inviteStatus === "accepted") {
      return (
        <div className="mb-4 p-4 rounded-md bg-muted border border-border text-sm space-y-2">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <AlertCircle className="h-4 w-4" />
            Invitation already used
          </div>
          <p className="text-muted-foreground">
            This invitation has already been accepted. Sign in below with a magic link to access your portal.
          </p>
        </div>
      );
    }

    if (inviteStatus === "link_expired") {
      return (
        <div className="mb-4 p-4 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
            <AlertCircle className="h-4 w-4" />
            Your sign-in link has expired
          </div>
          <p className="text-muted-foreground">
            No worries — click below to get a new one sent to <span className="font-medium text-foreground">{inviteEmail}</span>.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResendInviteLink}
            disabled={resendingLink || magicLinkSent}
            className="w-full"
          >
            {resendingLink ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {magicLinkSent ? "Link sent — check your email" : "Send me a new link"}
          </Button>
        </div>
      );
    }

    if (inviteStatus === "invite_expired") {
      return (
        <div className="mb-4 p-4 rounded-md bg-destructive/10 border border-destructive/20 text-sm space-y-2">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertCircle className="h-4 w-4" />
            This invitation has expired
          </div>
          <p className="text-muted-foreground">
            Invitations are valid for 7 days. Please contact your agent to request a new invitation — this link can't be reused.
          </p>
        </div>
      );
    }

    if (inviteStatus === "valid") {
      return (
        <div className="mb-4 p-3 rounded-md bg-primary/10 border border-primary/20 text-sm text-primary">
          Welcome! Enter your email below to access your portal.
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center gap-4 mb-8">
          <img src={sitelogo} alt="TruckShield" className="h-20 w-auto rounded-xl" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">TruckShield</h1>
            <p className="text-sm text-muted-foreground font-mono">Powered by 360 Risk Partners</p>
          </div>
        </div>

        <div className="glass-panel rounded-lg p-8">
          {/* Invite banners */}
          {staffInviteToken && (
            <div className="mb-4 p-3 rounded-md bg-primary/10 border border-primary/20 text-sm text-primary">
              You've been invited to join the TruckShield team. {isLogin ? "Sign in" : "Create an account"} to get started.
            </div>
          )}
          {renderInviteBanner()}

          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {isStaffFlow
                ? (staffUseMagicLink || staffMagicLinkSent
                    ? "Staff Sign In"
                    : isLogin ? "Staff Sign In" : "Create Staff Account")
                : "Sign In"}
            </h2>
          </div>

          {/* ====== STAFF FLOW ====== */}
          {isStaffFlow ? (
            <>
              {staffMagicLinkSent ? (
                <div className="text-center space-y-4 py-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Check your email</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setStaffMagicLinkSent(false); setStaffUseMagicLink(false); }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Use a different method
                  </button>
                </div>
              ) : staffUseMagicLink ? (
                <>
                  <form onSubmit={handleStaffMagicLink} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Enter your email and we'll send you a link to sign in — no password needed.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                      Send Magic Link
                    </Button>
                  </form>
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setStaffUseMagicLink(false)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      Sign in with password instead
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <form onSubmit={handleStaffSubmit} className="space-y-4">
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="John Doe"
                          required={!isLogin}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {isLogin ? "Sign In" : "Create Account"}
                    </Button>
                  </form>

                  <div className="mt-4 text-center space-y-2">
                    {isLogin && (
                      <>
                        <button
                          type="button"
                          onClick={() => setStaffUseMagicLink(true)}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                        >
                          Sign in with magic link instead
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!email) {
                              toast({ title: "Enter your email first", variant: "destructive" });
                              return;
                            }
                            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                              redirectTo: `${window.location.origin}/reset-password`,
                            });
                            if (error) {
                              toast({ title: "Error", description: error.message, variant: "destructive" });
                            } else {
                              toast({ title: "Check your email", description: "Password reset link sent." });
                            }
                          }}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                        >
                          Forgot password?
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* ====== CLIENT FLOW: magic link ====== */
            <>
              {magicLinkSent ? (
                <div className="text-center space-y-4 py-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Check your email</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMagicLinkSent(false)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Use a different email
                  </button>
                </div>
              ) : inviteStatus === "expired" || inviteStatus === "invalid" ? null : (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {inviteEmail
                      ? "Click below to access your portal — no password needed."
                      : "Enter your email and we'll send you a link to sign in — no password needed."}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      readOnly={!!inviteEmail}
                      className={inviteEmail ? "bg-muted" : ""}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                    Send Magic Link
                  </Button>
                </form>
              )}
            </>
          )}

          {/* Staff login link for admins who visit /auth directly */}
          {!isStaffFlow && (
            <div className="mt-6 pt-4 border-t border-border text-center">
              <button
                type="button"
                onClick={() => navigate("/auth?mode=staff")}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Staff login →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
