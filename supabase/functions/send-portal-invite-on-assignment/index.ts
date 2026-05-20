import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function resolveProducerEmail(
  supabase: ReturnType<typeof createClient>,
  producerUserId: string | null | undefined,
  recipientEmail: string,
): Promise<{ email: string | null; name: string | null }> {
  if (!producerUserId) return { email: null, name: null }
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', producerUserId)
      .single()
    const name = prof?.full_name ?? null
    const email = prof?.email?.toLowerCase()
    if (!email || email === recipientEmail.toLowerCase()) return { email: null, name }

    const { data: suppressed } = await supabase
      .from('suppressed_emails')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (suppressed) return { email: null, name }

    const { data: token } = await supabase
      .from('email_unsubscribe_tokens')
      .select('used_at')
      .eq('email', email)
      .maybeSingle()
    if (token?.used_at) return { email: null, name }

    return { email, name }
  } catch {
    return { email: null, name: null }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (token !== supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let accountId: string
  try {
    const body = await req.json()
    accountId = body.account_id
    if (!accountId) throw new Error('Missing account_id')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: account, error: acctErr } = await supabase
    .from('accounts')
    .select('id, contact_email, company_name, business_owner_name, client_user_id, assigned_producer_id')
    .eq('id', accountId)
    .single()

  if (acctErr || !account) {
    console.log('Account not found', { accountId, acctErr })
    return new Response(JSON.stringify({ success: false, reason: 'account_not_found' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Defense-in-depth guards (mirror the trigger)
  if (!account.contact_email || account.client_user_id || !account.assigned_producer_id) {
    return new Response(JSON.stringify({ success: false, reason: 'guard_failed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const contactEmail = (account.contact_email as string).trim().toLowerCase()

  // Skip if invitation already exists
  const { data: existingInvite } = await supabase
    .from('client_invitations')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle()

  if (existingInvite) {
    return new Response(JSON.stringify({ success: false, reason: 'invitation_exists' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Create invitation
  const { data: invitation, error: invErr } = await supabase
    .from('client_invitations')
    .insert({
      account_id: accountId,
      email: contactEmail,
    })
    .select()
    .single()

  if (invErr || !invitation) {
    console.error('Failed to create invitation', invErr)
    return new Response(JSON.stringify({ success: false, reason: 'invitation_insert_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // send-transactional-email owns fresh auth-link generation at render time.
  // Pass only the stable invite token/redirect so first invites and resends
  // follow the same path and never reuse a Supabase auth token.
  const inviteRedirect = `https://truckshield.360riskpartners.com/auth?invite=${invitation.token}`

  const firstName =
    (account.business_owner_name as string | null)?.split(/\s+/)[0] ||
    contactEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

  // Lookup producer name for activity log only — send-transactional-email
  // auto-resolves cc/reply_to from accountId
  const { name: producerName } = await resolveProducerEmail(
    supabase,
    account.assigned_producer_id as string,
    contactEmail,
  )

  const { error: sendErr } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'client-portal-invite',
      recipientEmail: contactEmail,
      idempotencyKey: `portal-invite-${invitation.id}`,
      templateData: { firstName, portalLink: inviteRedirect, inviteToken: invitation.token },
      accountId,
    },
  })

  if (sendErr) {
    console.error('send-transactional-email failed', sendErr)
  }

  await supabase.from('activity_log').insert({
    account_id: accountId,
    action_type: 'client_linked',
    description: producerName
      ? `Auto-invitation sent to ${contactEmail} (triggered by producer assignment to ${producerName})`
      : `Auto-invitation sent to ${contactEmail} (triggered by producer assignment)`,
  })

  return new Response(JSON.stringify({ success: true, invitation_id: invitation.id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})