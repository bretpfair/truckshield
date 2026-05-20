import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a client invitation and sends the invite email with a single-click magic link.
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
    .select("id, token")
    .eq("account_id", accountId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) {
    // Resend with a fresh magic link
    const portalLink = await generateMagicLink(normalizedEmail, existingInvite.token);
    const firstName = deriveFirstName(normalizedEmail);

    // Backfill account.contact_email if empty so downstream client emails work
    await backfillContactEmail(accountId, normalizedEmail);

    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "client-portal-invite",
        recipientEmail: normalizedEmail,
        accountId,
        idempotencyKey: `portal-invite-resend-${existingInvite.id}-${Date.now()}`,
        templateData: { firstName, portalLink, companyName },
      },
    });

    // Log activity
    await supabase.from("activity_log").insert({
      account_id: accountId,
      user_id: invitedBy || (await supabase.auth.getUser()).data.user?.id,
      action_type: "client_invite_resent",
      description: `Portal invite resent to ${normalizedEmail}`,
    });

    return { sent: true, message: `Invite resent to ${normalizedEmail}` };
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

  // Backfill account.contact_email if empty — source for later client emails
  await backfillContactEmail(accountId, normalizedEmail);

  // Generate a single-click magic link
  const portalLink = await generateMagicLink(normalizedEmail, invitation.token);
  const firstName = deriveFirstName(normalizedEmail);

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

  // Log activity
  await supabase.from("activity_log").insert({
    account_id: accountId,
    user_id: userId,
    action_type: "client_invite_sent",
    description: `Portal invite sent to ${normalizedEmail}`,
  });

  return { sent: true, message: `Invite sent to ${normalizedEmail}` };
}

/**
 * Calls the Edge Function to generate a combined magic link + invite token URL.
 * Falls back to a plain invite URL if the magic link generation fails.
 */
async function generateMagicLink(email: string, inviteToken: string): Promise<string> {
  const redirectTo = `${window.location.origin}/auth?invite=${inviteToken}`;

  try {
    const { data, error } = await supabase.functions.invoke("create-client-magic-link", {
      body: { email, inviteToken, redirectTo },
    });

    if (error || !data?.magicLink) {
      console.warn("Magic link generation failed, falling back to plain invite link:", error);
      return redirectTo;
    }

    return data.magicLink;
  } catch (err) {
    console.warn("Magic link generation failed, falling back to plain invite link:", err);
    return redirectTo;
  }
}

function deriveFirstName(email: string): string {
  return email
    .split("@")[0]
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

async function backfillContactEmail(accountId: string, normalizedEmail: string): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ contact_email: normalizedEmail })
    .eq("id", accountId)
    .or("contact_email.is.null,contact_email.eq.");
  if (error) {
    console.error("Failed to backfill accounts.contact_email", { accountId, error });
    throw new Error(`Could not store invite email on account: ${error.message}`);
  }
}
