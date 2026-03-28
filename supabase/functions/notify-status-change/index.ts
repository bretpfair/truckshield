import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = "truckshield"
const SENDER_DOMAIN = "notify.360riskpartners.com"
const FROM_DOMAIN = "360riskpartners.com"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Validate service role key from Authorization header
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (token !== supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let accountId: string
  let newStatus: string
  try {
    const body = await req.json()
    accountId = body.account_id
    newStatus = body.new_status
    if (!accountId || !newStatus) throw new Error('Missing required fields')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Fetch account + client info
  const { data: account, error: acctErr } = await supabase
    .from('accounts')
    .select('contact_email, company_name, client_user_id')
    .eq('id', accountId)
    .single()

  if (acctErr || !account?.contact_email) {
    console.log('No client email for account, skipping', { accountId })
    return new Response(JSON.stringify({ success: false, reason: 'no_client_email' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get client first name
  let firstName: string | undefined
  if (account.client_user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', account.client_user_id)
      .single()
    firstName = profile?.full_name?.split(' ')[0]
  }

  const templateName = 'pipeline-status-change'
  const template = TEMPLATES[templateName]
  if (!template) {
    return new Response(JSON.stringify({ error: 'Template not found' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const recipientEmail = account.contact_email
  const messageId = crypto.randomUUID()
  const idempotencyKey = `auto-pipeline-${accountId}-${newStatus}-${Date.now()}`

  // Check suppression
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', recipientEmail.toLowerCase())
    .maybeSingle()

  if (suppressed) {
    console.log('Email suppressed', { recipientEmail })
    return new Response(JSON.stringify({ success: false, reason: 'suppressed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get or create unsubscribe token
  const normalizedEmail = recipientEmail.toLowerCase()
  let unsubscribeToken: string

  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true })

    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (stored) unsubscribeToken = stored.token
  } else {
    console.log('Token already used, skipping')
    return new Response(JSON.stringify({ success: false, reason: 'unsubscribed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const templateData = {
    firstName,
    companyName: account.company_name,
    newStatus,
    portalLink: 'https://truckshield.lovable.app/client',
  }

  // Render email
  const html = await renderAsync(React.createElement(template.component, templateData))
  const plainText = await renderAsync(React.createElement(template.component, templateData), { plainText: true })
  const resolvedSubject = typeof template.subject === 'function' ? template.subject(templateData) : template.subject

  // Log pending
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: recipientEmail,
    status: 'pending',
  })

  // Enqueue
  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', enqueueError)
    return new Response(JSON.stringify({ error: 'Failed to enqueue' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Auto pipeline status email enqueued', { recipientEmail, newStatus })
  return new Response(JSON.stringify({ success: true, queued: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
