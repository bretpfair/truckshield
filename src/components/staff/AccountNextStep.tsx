import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, AlertTriangle, Clock, CheckCircle2, ClipboardList, Zap, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast as sonnerToast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchInviteSnapshot } from "@/lib/getInviteSnapshot";
import { sendClientInvite } from "@/lib/sendClientInvite";
import { useAuth } from "@/hooks/useAuth";

type Account = {
  id: string;
  status: string;
  contact_email?: string | null;
  client_user_id?: string | null;
  company_name: string;
  application_step?: number | null;
};

interface Props {
  account: Account;
  onOpenApplication?: () => void;
  onScrollToMarkets?: () => void;
  onEditEmail?: () => void;
}

const AccountNextStep = ({ account, onOpenApplication, onScrollToMarkets, onEditEmail }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: snapshot } = useQuery({
    queryKey: ["invite-snapshot", account.id, account.client_user_id ?? null],
    queryFn: () => fetchInviteSnapshot(account.id, account.client_user_id),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["invite-snapshot", account.id] }),
      queryClient.invalidateQueries({ queryKey: ["account", account.id] }),
      queryClient.invalidateQueries({ queryKey: ["email-send-log", account.id] }),
      queryClient.invalidateQueries({ queryKey: ["activity_log", account.id] }),
      queryClient.invalidateQueries({ queryKey: ["invitations"] }),
    ]);
  };

  const sendInvite = async () => {
    if (!account.contact_email) return;
    setBusy(true);
    try {
      const result = await sendClientInvite({
        accountId: account.id,
        email: account.contact_email,
        invitedBy: user?.id,
        companyName: account.company_name,
      });
      if (result.sent) sonnerToast.success(result.message);
      else sonnerToast.info(result.message);
      await refresh();
    } catch (e: any) {
      sonnerToast.error("Failed to send invite", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  // ── Inference (first match wins). Hide banner if nothing confident. ──
  let tone: "warning" | "destructive" | "primary" | "success" | "muted" = "primary";
  let Icon = Clock;
  let title = "";
  let detail: string | null = null;
  let action: { label: string; onClick: () => void; icon?: typeof Mail; disabled?: boolean } | null = null;

  const inv = snapshot?.invitation;
  const lastEmail = snapshot?.lastInviteEmail;
  const inviteStatus = snapshot?.inviteStatus ?? "unknown";
  const emailStatus = snapshot?.emailStatus ?? "unknown";

  const emailNewerThanInvite = !!(lastEmail && (!inv || new Date(lastEmail.created_at) >= new Date(inv.created_at)));
  const emailFailed = ["failed", "bounced", "dlq"].includes(emailStatus);

  if (!account.contact_email) {
    tone = "warning"; Icon = Mail;
    title = "Client email missing";
    detail = "Add a contact email so the client can be invited to the portal.";
    if (onEditEmail) action = { label: "Add Email", onClick: onEditEmail, icon: Mail };
  } else if (emailFailed && emailNewerThanInvite) {
    tone = "destructive"; Icon = AlertTriangle;
    title = "Invite email delivery failed";
    detail = lastEmail?.error_message?.slice(0, 140) || "Last invite email did not deliver.";
    action = { label: busy ? "Retrying…" : "Retry", onClick: sendInvite, icon: RefreshCw, disabled: busy };
  } else if (inviteStatus === "pending") {
    tone = "warning"; Icon = Clock;
    title = "Client invited, waiting for portal access";
    detail = `Invite sent to ${inv?.email ?? account.contact_email}. They haven't signed in yet.`;
    action = { label: busy ? "Sending…" : "Send New Link", onClick: sendInvite, icon: Mail, disabled: busy };
  } else if (inviteStatus === "active" || inviteStatus === "accepted") {
    tone = "success"; Icon = CheckCircle2;
    title = "Client portal access active";
    detail = null;
  } else if (account.status === "pending_info" && (account.application_step ?? 0) < 10) {
    tone = "primary"; Icon = ClipboardList;
    title = "Application incomplete";
    detail = `Step ${account.application_step ?? 1} of 10.`;
    if (onOpenApplication) action = { label: "View Application", onClick: onOpenApplication, icon: ClipboardList };
  } else if (account.status === "pending_info" || account.status === "info_complete") {
    tone = "primary"; Icon = Zap;
    title = "Ready to check markets";
    if (onScrollToMarkets) action = { label: "Check Markets", onClick: onScrollToMarkets, icon: Zap };
  } else {
    return null;
  }

  const toneClasses: Record<typeof tone, string> = {
    warning: "border-l-warning bg-warning/5",
    destructive: "border-l-destructive bg-destructive/5",
    primary: "border-l-primary bg-primary/5",
    success: "border-l-success bg-success/5",
    muted: "border-l-border bg-muted/30",
  } as any;

  const iconClass: Record<typeof tone, string> = {
    warning: "text-warning",
    destructive: "text-destructive",
    primary: "text-primary",
    success: "text-success",
    muted: "text-muted-foreground",
  } as any;

  const ActionIcon = action?.icon;

  return (
    <div
      className={`glass-panel border-l-4 ${toneClasses[tone]} rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3`}
      role="status"
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconClass[tone]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5 break-words">{detail}</p>}
      </div>
      {action && (
        <Button
          size="sm"
          variant={tone === "destructive" ? "destructive" : "default"}
          className="gap-1.5 shrink-0 self-start sm:self-auto"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {busy && (action.label.includes("…")) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ActionIcon ? <ActionIcon className="h-3.5 w-3.5" /> : null}
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default AccountNextStep;