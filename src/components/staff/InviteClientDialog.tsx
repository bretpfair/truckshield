import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Copy, Check, Mail, Clock, CheckCircle2 } from "lucide-react";

interface Props {
  accountId?: string;
  defaultEmail?: string;
}

const statusBadge: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-warning/10 text-warning border-warning/20" },
  accepted: { label: "Accepted", color: "bg-success/10 text-success border-success/20" },
  expired: { label: "Expired", color: "bg-muted text-muted-foreground" },
};

const InviteClientDialog = ({ accountId, defaultEmail }: Props) => {
  const [email, setEmail] = useState(defaultEmail || "");
  const [selectedAccountId, setSelectedAccountId] = useState(accountId || "");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: unassignedAccounts } = useQuery({
    queryKey: ["unassigned-accounts"],
    enabled: !accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, company_name")
        .is("client_user_id", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: invitations } = useQuery({
    queryKey: ["invitations", selectedAccountId || "all"],
    queryFn: async () => {
      let query = supabase
        .from("client_invitations")
        .select("*, accounts(company_name)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (selectedAccountId) {
        query = query.eq("account_id", selectedAccountId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      const targetAccountId = accountId || selectedAccountId;
      if (!targetAccountId || !email) throw new Error("Missing fields");
      const { data, error } = await supabase
        .from("client_invitations")
        .insert({
          account_id: targetAccountId,
          email: email.trim().toLowerCase(),
          invited_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["activity_log"] });
      // Log activity
      supabase.from("activity_log").insert({
        account_id: data.account_id,
        user_id: user!.id,
        action_type: "client_linked",
        description: `Invitation sent to ${email}`,
      });

      // Send invite email automatically
      const portalLink = getInviteUrl(data.token);
      const firstName = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "client-portal-invite",
            recipientEmail: email.trim().toLowerCase(),
            accountId: selectedAccountId,
            idempotencyKey: `portal-invite-${data.id}`,
            templateData: { firstName, portalLink },
          },
        });
        toast({ title: "Invitation sent", description: "Portal invite email sent to the client." });
      } catch {
        toast({ title: "Invitation created", description: "Email delivery may be delayed while your domain verifies." });
      }
      setEmail("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getInviteUrl = (token: string) => `${window.location.origin}/auth?invite=${token}`;

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
          <UserPlus className="h-4 w-4 text-primary" /> Invite Client
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {!accountId && unassignedAccounts && unassignedAccounts.length > 0 && (
            <select
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm flex-1"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="">Select account...</option>
              {unassignedAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.company_name}</option>
              ))}
            </select>
          )}
          <Input
            placeholder="Client email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => sendInvite.mutate()}
            disabled={!email || (!accountId && !selectedAccountId)}
            className="gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" /> Send Invite
          </Button>
        </div>

        {invitations && invitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Recent Invitations</p>
            {invitations.map((inv: any) => {
              const cfg = statusBadge[inv.status] || statusBadge.pending;
              const isExpired = new Date(inv.expires_at) < new Date() && inv.status === "pending";
              return (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {(inv as any).accounts?.company_name}
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

export default InviteClientDialog;
