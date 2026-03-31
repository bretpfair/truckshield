import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Truck, Shield, Mail, Loader2 } from "lucide-react";
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

  const isStaffFlow = !!(staffInviteToken || mode === "staff");
  const [isLogin, setIsLogin] = useState(true);
  const [staffUseMagicLink, setStaffUseMagicLink] = useState(false);
  const [staffMagicLinkSent, setStaffMagicLinkSent] = useState(false);

  useEffect(() => {
    if (staffInviteToken) setIsLogin(false);
  }, [staffInviteToken]);

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
  const acceptInvitation = async () => {
    if (!inviteToken) return;
    try {
      const { data, error } = await supabase.rpc("accept_invitation", { p_token: inviteToken });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in (data as any)) {
        toast({ title: "Invitation issue", description: (data as any).error, variant: "destructive" });
      } else {
        toast({ title: "Welcome!", description: "Your account has been linked." });
      }
    } catch (err: any) {
      console.error("Invite acceptance error:", err);
    }
  };

  // Detect existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        if (inviteToken) {
          try { await acceptInvitation(); } catch {}
        }
        if (staffInviteToken) {
          await acceptStaffInvitation();
        }
        navigate("/");
      }
    });
  }, [inviteToken, staffInviteToken, navigate]);

  // --- STAFF: password-based login/signup ---
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        if (staffInviteToken) await acceptStaffInvitation();
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
          if (staffInviteToken) await acceptStaffInvitation();
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
          {inviteToken && (
            <div className="mb-4 p-3 rounded-md bg-primary/10 border border-primary/20 text-sm text-primary">
              You've been invited to join TruckShield. Enter your email below to sign in.
            </div>
          )}

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
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-4">
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