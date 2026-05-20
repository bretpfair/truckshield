import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Public endpoint: anyone holding a still-pending invite token can request a
// fresh branded TruckShield portal invite email (with a brand-new magic link).
// We never reuse Supabase auth tokens — every call generates a new one.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { invite_token } = await req.json().catch(() => ({}));
    if (!invite_token || typeof invite_token !== "string") {
      return json({ error: "invite_token is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: invitation, error: invErr } = await admin
      .from("client_invitations")
      .select("id, email, status, expires_at, account_id")
      .eq("token", invite_token)
      .maybeSingle();

    if (invErr || !invitation) {
      return json({ error: "Invalid invitation" }, 400);
    }
    if (invitation.status !== "pending") {
      return json({ error: "This invitation has already been used." }, 400);
    }
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      return json({ error: "This invitation has expired." }, 400);
    }

    const email = (invitation.email as string).trim().toLowerCase();
    const inviteRedirect = `${new URL(req.url).origin.replace(
      /functions\..*$/,
      "",
    )}`; // not used
    // Use the configured public site URL for the redirect target.
    const siteUrl = "https://truckshield.360riskpartners.com";
    const redirectTo = `${siteUrl}/auth?invite=${invite_token}`;

    // Generate a brand-new magic link (this invalidates any previous one)
    let portalLink = redirectTo;
    try {
      const { data: linkData, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        } as any);
      const hashedToken = (linkData as any)?.properties?.hashed_token;
      if (!linkError && hashedToken) {
        portalLink = `${supabaseUrl}/auth/v1/verify?token=${hashedToken}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`;
      } else {
        console.warn("generateLink failed, falling back", linkError);
      }
    } catch (e) {
      console.warn("generateLink threw, falling back", e);
    }

    // Lookup company name + first name for the template
    const { data: account } = await admin
      .from("accounts")
      .select("company_name, business_owner_name")
      .eq("id", invitation.account_id)
      .maybeSingle();

    const firstName =
      (account?.business_owner_name as string | null)?.split(/\s+/)[0] ||
      email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const { error: sendErr } = await admin.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "client-portal-invite",
          recipientEmail: email,
          accountId: invitation.account_id,
          idempotencyKey: `portal-invite-resend-${invitation.id}-${Date.now()}`,
          templateData: {
            firstName,
            portalLink,
            companyName: account?.company_name ?? undefined,
          },
        },
      },
    );

    if (sendErr) {
      console.error("send-transactional-email failed", sendErr);
      return json({ error: "Could not send invite email. Please try again." }, 500);
    }

    await admin.from("activity_log").insert({
      account_id: invitation.account_id,
      action_type: "client_invite_resent",
      description: `Client requested a fresh portal link (sent to ${email})`,
    });

    return json({ success: true });
  } catch (err) {
    console.error("resend-client-portal-invite error", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}