import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Copy, Check, Mail, ShieldCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusBadge: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-warning/10 text-warning border-warning/20" },
  accepted: { label: "Accepted", color: "bg-success/10 text-success border-success/20" },
  expired: { label: "Expired", color: "bg-muted text-muted-foreground" },
};

const InviteStaffDialog = () => {
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "producer">("producer");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations } = useQuery({
    queryKey: ["staff-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_invitations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!email) throw new Error("Email required");
      const normalizedEmail = email.trim().toLowerCase();

      // Check for existing pending invite
      const { data: existing } = await supabase
        .from("staff_invitations")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) throw new Error("A pending invite already exists for this email");

      const { data, error } = await supabase
        .from("staff_invitations")
        .insert({
          email: normalizedEmail,
          invited_by: user!.id,
          invited_role: selectedRole,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["staff-invitations"] });

      // Send invite email
      const portalLink = `${window.location.origin}/auth?staff_invite=${data.token}`;
      const firstName = email
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "client-portal-invite",
            recipientEmail: email.trim().toLowerCase(),
            idempotencyKey: `staff-invite-${data.id}`,
            templateData: {
              firstName,
              portalLink,
              companyName: "360 Risk Partners (Staff Access)",
            },
          },
        });
        toast({ title: "Staff invite sent", description: `Invitation email sent to ${email}` });
      } catch {
        toast({ title: "Invite created", description: "Copy the link below to share manually." });
      }
      setEmail("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getInviteUrl = (token: string) => `${window.location.origin}/auth?staff_invite=${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getInviteUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" /> Invite Staff Member
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Send an invitation to a new team member. They'll receive admin access upon signup.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Staff email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && email && sendInvite.mutate()}
          />
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "admin" | "producer")}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="producer">Producer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => sendInvite.mutate()}
            disabled={!email || sendInvite.isPending}
            className="gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" /> Send Invite
          </Button>
        </div>

        {invitations && invitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Recent Staff Invitations</p>
            {invitations.map((inv: any) => {
              const cfg = statusBadge[inv.status] || statusBadge.pending;
              const isExpired = new Date(inv.expires_at) < new Date() && inv.status === "pending";
              return (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={isExpired ? statusBadge.expired.color : cfg.color}>
                      {isExpired ? "Expired" : cfg.label}
                    </Badge>
                    {inv.status === "pending" && !isExpired && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => copyLink(inv.token)}
                      >
                        {copiedToken === inv.token ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InviteStaffDialog;
