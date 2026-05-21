import { supabase } from "@/integrations/supabase/client";

export type InviteRow = {
  id: string;
  account_id: string;
  email: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type LatestInviteEmailRow = {
  id: string;
  created_at: string;
  status: string;
  error_message: string | null;
  message_id: string | null;
  metadata: any;
};

export type InviteEmailStatus =
  | "queued"
  | "pending"
  | "sent"
  | "failed"
  | "bounced"
  | "complained"
  | "suppressed"
  | "rate_limited"
  | "dlq"
  | "unknown";

export type InviteStatus =
  | "active"
  | "accepted"
  | "pending"
  | "expired"
  | "none"
  | "unknown";

export interface InviteSnapshot {
  invitation: InviteRow | null;
  lastInviteEmail: LatestInviteEmailRow | null;
  inviteStatus: InviteStatus;
  emailStatus: InviteEmailStatus;
  safeInviteUrl: string | null;
}

export const normalizeEmailStatus = (raw?: string | null): InviteEmailStatus => {
  const s = (raw || "").toLowerCase();
  if (s === "queued" || s === "pending" || s === "sent" || s === "failed" || s === "bounced" ||
      s === "complained" || s === "suppressed" || s === "rate_limited" || s === "dlq") return s;
  return "unknown";
};

export const deriveInviteStatus = (
  invitation: InviteRow | null,
  clientUserId?: string | null,
): InviteStatus => {
  if (clientUserId) return "active";
  if (!invitation) return "none";
  if (invitation.status === "accepted") return "accepted";
  if (invitation.status === "expired") return "expired";
  if (invitation.status === "pending") {
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) return "expired";
    return "pending";
  }
  return "unknown";
};

export async function fetchInviteSnapshot(
  accountId: string,
  clientUserId?: string | null,
): Promise<InviteSnapshot> {
  const [invRes, emailRes] = await Promise.all([
    supabase
      .from("client_invitations")
      .select("id, account_id, email, token, status, expires_at, created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("email_send_log")
      .select("id, created_at, status, error_message, message_id, metadata")
      .eq("template_name", "client-portal-invite")
      .filter("metadata->>account_id", "eq", accountId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const invitation = (invRes.data?.[0] as InviteRow) || null;
  const lastInviteEmail = (emailRes.data?.[0] as LatestInviteEmailRow) || null;

  const inviteStatus = deriveInviteStatus(invitation, clientUserId);
  const emailStatus = lastInviteEmail ? normalizeEmailStatus(lastInviteEmail.status) : "unknown";

  // Only safe to copy/show the stable /auth?invite=<token> URL — never a
  // Supabase magic-link/hashed URL (those are single-use).
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const safeInviteUrl = invitation && inviteStatus === "pending"
    ? `${origin}/auth?invite=${invitation.token}`
    : null;

  return { invitation, lastInviteEmail, inviteStatus, emailStatus, safeInviteUrl };
}