import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Truck, Shield } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const { toast } = useToast();

  // If arriving with invite token, default to signup
  useEffect(() => {
    if (inviteToken) setIsLogin(false);
  }, [inviteToken]);

  // Handle returning from email verification link — detect existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Already authenticated (e.g. returning from email verification)
        if (inviteToken) {
          try {
            await supabase.rpc("accept_invitation", { p_token: inviteToken });
          } catch (err) {
            console.error("Auto invite acceptance error:", err);
          }
        }
        navigate("/");
      }
    });
  }, [inviteToken, navigate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        if (inviteToken) await acceptInvitation();
        navigate("/");
      }
    } else {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin + (inviteToken ? `/auth?invite=${inviteToken}` : ""),
        },
      });
      if (error) {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      } else {
        // If auto-confirmed (session exists), accept invite immediately
        if (signUpData.session && inviteToken) {
          await acceptInvitation();
          navigate("/");
        } else {
          toast({ title: "Account created", description: "Check your email to verify your account." });
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-3 bg-primary/10 rounded-lg glow-primary">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">TruckShield</h1>
            <p className="text-sm text-muted-foreground font-mono">Commercial Trucking Portal</p>
          </div>
        </div>

        <div className="glass-panel rounded-lg p-8">
          {inviteToken && (
            <div className="mb-4 p-3 rounded-md bg-primary/10 border border-primary/20 text-sm text-primary">
              You've been invited to join TruckShield. {isLogin ? "Sign in" : "Create an account"} to access your portal.
            </div>
          )}
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{isLogin ? "Sign In" : "Create Account"}</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            {isLogin && (
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
            )}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
