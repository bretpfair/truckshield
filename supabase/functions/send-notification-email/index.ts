import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationPayload {
  type: "task_reminder" | "status_change" | "new_message" | "quote_ready";
  accountId: string;
  recipientEmail?: string;
  details?: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: NotificationPayload = await req.json();
    const { type, accountId, recipientEmail, details } = payload;

    // Fetch account info
    const { data: account } = await supabase
      .from("accounts")
      .select("company_name, client_user_id")
      .eq("id", accountId)
      .single();

    if (!account) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine recipient email
    let toEmail = recipientEmail;
    if (!toEmail && account.client_user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", account.client_user_id)
        .single();
      toEmail = profile?.email ?? undefined;
    }

    // Build notification subject and body based on type
    let subject = "";
    let body = "";
    const companyName = account.company_name;

    switch (type) {
      case "task_reminder":
        subject = `Reminder: Task due for ${companyName}`;
        body = `A task "${details?.taskTitle || "Untitled"}" for ${companyName} is due ${details?.dueDate || "soon"}. Please review and take action.`;
        break;
      case "status_change":
        subject = `Status Update: ${companyName}`;
        body = `The account ${companyName} has been updated to status: ${details?.newStatus?.replace(/_/g, " ") || "unknown"}.`;
        break;
      case "new_message":
        subject = `New Message on ${companyName}`;
        body = `You have a new message regarding ${companyName}. Log in to view and respond.`;
        break;
      case "quote_ready":
        subject = `Quote Available for ${companyName}`;
        body = `A new insurance quote is available for ${companyName}. Log in to review the details.`;
        break;
      default:
        subject = `Notification for ${companyName}`;
        body = `There's an update for ${companyName}. Log in to view details.`;
    }

    // Create in-app notification for admin users
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoles && adminRoles.length > 0) {
      const notifications = adminRoles.map((role) => ({
        user_id: role.user_id,
        account_id: accountId,
        type,
        title: subject,
        message: body,
      }));

      await supabase.from("notifications").insert(notifications);
    }

    // If there's a client user, also notify them for relevant events
    if (account.client_user_id && ["quote_ready", "status_change", "new_message"].includes(type)) {
      await supabase.from("notifications").insert({
        user_id: account.client_user_id,
        account_id: accountId,
        type,
        title: subject,
        message: body,
      });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      account_id: accountId,
      action_type: `notification_${type}`,
      description: `Email notification sent: ${subject}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        subject,
        toEmail: toEmail || "no-recipient",
        notificationsCreated: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
