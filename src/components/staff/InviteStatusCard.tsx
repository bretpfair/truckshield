import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { Copy, Check, Mail, RefreshCw, Loader2, ExternalLink, UserPlus } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchInviteSnapshot } from "@/lib/getInviteSnapshot";
import { sendClientInvite } from "@/lib/sendClientInvite";
import { useAuth } from "@/hooks/useAuth";
import { EmailStatusBadge, InviteStatusBadge } from "./EmailStatusBadge";

type Account = {
  id: string;
  contact_email?: string | null;
  client_user_id?: string | null;
  company_name: string;
};

interface Props {
  account: Account;
  onEditEmail?: () => void;
  onViewEmailLog?: () => void;
}

const InviteStatusCard = ({ account, onEditEmail, onViewEmailLog }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ["invite-snapshot", account.id, account.client_user_id ?? null],
    queryFn: () => fetchInviteSnapshot(account.id, account.client_user_id),
  });

  const send = async (overrideEmail?: string) => {
    const target = (overrideEmail ?? account.contact_email ?? "").trim();
    if (!target) {
      onEditEmail?.();
      return;
    }
    setBusy(true);
    try {
      const result = await sendClientInvite({
        accountId: account.id,
        email: target,
        invitedBy: user?.id,
        companyName: account.company_name,
      });
      if (result.sent) sonnerToast.success(result.message);
      else sonnerToast.info(result.message);
      setEmailDraft("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invite-snapshot", account.id] }),
        queryClient.invalidateQueries({ queryKey: ["account", account.id] }),
        queryClient.invalidateQueries({ queryKey: ["email-send-log", account.id] }),
        queryClient.invalidateQueries({ queryKey: ["activity_log", account.id] }),
        queryClient.invalidateQueries({ queryKey: ["invitations"] }),
      ]);
    } catch (e: any) {
      sonnerToast.error("Failed to send invite", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    if (!snapshot?.safeInviteUrl) return;
    navigator.clipboard.writeText(snapshot.safeInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    sonnerToast.success("Invite link copied");
  };

  const inviteStatus = snapshot?.inviteStatus ?? "unknown";
  const emailStatus = snapshot?.emailStatus ?? "unknown";
  const lastInviteSent = snapshot?.invitation?.created_at;
  const lastAccepted = inviteStatus === "accepted" || inviteStatus === "active"
    ? snapshot?.invitation?.created_at
    : null;

  const primaryLabel =
    inviteStatus === "active" || inviteStatus === "accepted"
      ? "Send New Invite"
      : inviteStatus === "pending"
        ? "Send New Link"
        : "Send Invite";

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" /> Client Portal Invite
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!account.contact_email && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-warning">Client email missing</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="client@example.com"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="h-9 flex-1"
              />
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy || !emailDraft.trim()}
                onClick={() => send(emailDraft)}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Save & Send Invite
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Saving will set the account contact email and send the portal invite.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Field label="Client Email">
            {account.contact_email ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium break-all">{account.contact_email}</span>
                {onEditEmail && (
                  <Button variant="ghost" size="sm" className="h-6 px-1 shrink-0 text-xs" onClick={onEditEmail}>
                    Edit
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground italic">Missing</span>
            )}
          </Field>
          <Field label="Invite Status">
            <InviteStatusBadge status={inviteStatus} />
          </Field>
          <Field label="Last Invite Sent">
            <span className="font-mono text-xs">
              {lastInviteSent ? format(new Date(lastInviteSent), "MMM d, yyyy h:mm a") : "—"}
            </span>
          </Field>
          <Field label="Email Delivery">
            {isLoading ? (
              <span className="text-xs text-muted-foreground">Loading…</span>
            ) : (
              <EmailStatusBadge status={emailStatus} />
            )}
          </Field>
          <Field label="Last Accepted">
            <span className="font-mono text-xs">
              {lastAccepted ? format(new Date(lastAccepted), "MMM d, yyyy h:mm a") : "—"}
            </span>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" className="gap-1.5" onClick={() => send()} disabled={busy || !account.contact_email}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
              inviteStatus === "pending" ? <RefreshCw className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {primaryLabel}
          </Button>
          {snapshot?.safeInviteUrl && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              Copy Link
            </Button>
          )}
          {onViewEmailLog && (
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={onViewEmailLog}>
              <ExternalLink className="h-3.5 w-3.5" /> View Email Log
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className="mt-0.5 min-w-0">{children}</div>
  </div>
);

export default InviteStatusCard;