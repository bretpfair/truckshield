import { Badge } from "@/components/ui/badge";
import type { InviteEmailStatus, InviteStatus } from "@/lib/getInviteSnapshot";

const emailClasses: Record<InviteEmailStatus, string> = {
  queued: "bg-warning/10 text-warning border-warning/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  sent: "bg-success/10 text-success border-success/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  bounced: "bg-destructive/10 text-destructive border-destructive/20",
  complained: "bg-destructive/10 text-destructive border-destructive/20",
  dlq: "bg-destructive/10 text-destructive border-destructive/20",
  rate_limited: "bg-warning/10 text-warning border-warning/20",
  suppressed: "bg-muted text-muted-foreground border-border",
  unknown: "bg-secondary text-muted-foreground border-border",
};

const emailLabels: Record<InviteEmailStatus, string> = {
  queued: "Queued",
  pending: "Pending",
  sent: "Sent",
  failed: "Failed",
  bounced: "Bounced",
  complained: "Complained",
  dlq: "DLQ",
  rate_limited: "Rate-Limited",
  suppressed: "Suppressed",
  unknown: "Unknown",
};

export const EmailStatusBadge = ({ status, className = "" }: { status: string; className?: string }) => {
  const key = (emailLabels as any)[status] ? (status as InviteEmailStatus) : "unknown";
  return (
    <Badge variant="outline" className={`text-[10px] ${emailClasses[key]} ${className}`}>
      {emailLabels[key]}
    </Badge>
  );
};

const inviteClasses: Record<InviteStatus, string> = {
  active: "bg-success/10 text-success border-success/20",
  accepted: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  expired: "bg-muted text-muted-foreground border-border",
  none: "bg-secondary text-muted-foreground border-border",
  unknown: "bg-secondary text-muted-foreground border-border",
};

const inviteLabels: Record<InviteStatus, string> = {
  active: "Active",
  accepted: "Accepted",
  pending: "Pending",
  expired: "Expired",
  none: "Not Sent",
  unknown: "Unknown",
};

export const InviteStatusBadge = ({ status, className = "" }: { status: InviteStatus; className?: string }) => (
  <Badge variant="outline" className={`text-[10px] ${inviteClasses[status]} ${className}`}>
    {inviteLabels[status]}
  </Badge>
);