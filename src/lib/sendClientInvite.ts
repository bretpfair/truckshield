import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a client invitation and sends the invite email.
 * Returns the invitation record or null if skipped (e.g. already invited).
 */
export async function sendClientInvite({
  accountId,
  email,
  invitedBy,
  companyName,
}: {
  accountId: string;
  email: string;
  invitedBy?: string;
  companyName?: string;
}): Promise<{ sent: boolean; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { sent: false, message: "No email provided" };

  // Check for existing pending invitation
  const { data: existingInvite } = await supabase
    .from("client_invitations")
    .select("id")
    .eq("account_id", accountId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) {
    // Resend the email for the existing pending invitation
    const { data: invite } = await supabase
      .from("client_invitations")
      .select("id, token")
      .eq("id", existingInvite.id)
      .single();

    if (invite) {
      const portalLink = `${window.location.origin}/auth?invite=${invite.token}`;
      const firstName = normalizedEmail
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "client-portal-invite",
          recipientEmail: normalizedEmail,
          accountId,
          idempotencyKey: `portal-invite-resend-${invite.id}-${Date.now()}`,
          templateData: { firstName, portalLink, companyName },
        },
      });

      return { sent: true, message: `Invite resent to ${normalizedEmail}` };
    }

    return { sent: false, message: "An invite is already pending for this email" };
  }

  // Create invitation
  const userId = invitedBy || (await supabase.auth.getUser()).data.user?.id;
  const { data: invitation, error } = await supabase
    .from("client_invitations")
    .insert({
      account_id: accountId,
      email: normalizedEmail,
      invited_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Build invite link
  const portalLink = `${window.location.origin}/auth?invite=${invitation.token}`;
  const firstName = normalizedEmail
    .split("@")[0]
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  // Send invite email
  await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "client-portal-invite",
      recipientEmail: normalizedEmail,
      accountId,
      idempotencyKey: `portal-invite-${invitation.id}`,
      templateData: { firstName, portalLink, companyName },
    },
  });

  return { sent: true, message: `Invite sent to ${normalizedEmail}` };
}
