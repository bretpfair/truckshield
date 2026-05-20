import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

// Configuration baked in at scaffold time — do NOT change these manually.
// To update, re-run the email domain setup flow.
const SITE_NAME = 'TruckShield'
const SITE_URL = 'https://truckshield.360riskpartners.com'
// SENDER_DOMAIN is the subdomain verified in Resend with SPF/DKIM/DMARC.
// Sending is performed by process-email-queue via the Resend connector gateway.
const SENDER_DOMAIN = 'truckshield.360riskpartners.com'
// FROM_DOMAIN is the domain shown in the From: header. Must be a domain
// (or subdomain of one) that is verified in Resend.
const FROM_DOMAIN = 'truckshield.360riskpartners.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function readInviteTokenFromUrl(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const direct = url.searchParams.get('invite')
    if (direct) return direct
    const redirect = url.searchParams.get('redirect_to') || url.searchParams.get('redirectTo')
    if (redirect) return readInviteTokenFromUrl(decodeURIComponent(redirect))
  } catch {
    const direct = value.match(/[?&]invite=([^&#]+)/i)?.[1]
    if (direct) return decodeURIComponent(direct)
    const redirect = value.match(/[?&]redirect_to=([^&#]+)/i)?.[1]
    if (redirect) return readInviteTokenFromUrl(decodeURIComponent(redirect))
  }
  return null
}

// Auth: verify JWT in code since verify_jwt is false (signing-keys system)

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Validate JWT in code
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const token = authHeader.replace('Bearer ', '')
  const isServiceCaller = token === supabaseServiceKey
  let callerUserId: string | null = null
  if (!isServiceCaller) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    callerUserId = claimsData.claims.sub as string
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  let accountId: string | undefined
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    accountId = body.accountId || body.account_id
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  const effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Create backend client with elevated privileges for validation, rendering,
  // enqueueing, and delivery metadata writes.
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Client portal invites must never reuse a previously rendered magic link.
  // If a caller passes older templateData from an email row, extract only the
  // stable invite token and replace portalLink with a brand-new auth token.
  if (templateName === 'client-portal-invite') {
    const inviteToken = readInviteTokenFromUrl(templateData.portalLink) || templateData.inviteToken || templateData.invite_token
    if (!inviteToken || typeof inviteToken !== 'string') {
      return new Response(JSON.stringify({ error: 'A fresh invite token is required for client portal invites' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: invitation, error: inviteLookupError } = await supabase
      .from('client_invitations')
      .select('email, status, expires_at')
      .eq('token', inviteToken)
      .maybeSingle()

    if (inviteLookupError || !invitation) {
      return new Response(JSON.stringify({ error: 'Invalid invitation token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (
      invitation.status !== 'pending' ||
      new Date(invitation.expires_at).getTime() < Date.now() ||
      String(invitation.email).toLowerCase() !== String(effectiveRecipient).toLowerCase()
    ) {
      return new Response(JSON.stringify({ error: 'Invitation is expired, already used, or not valid for this recipient' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const redirectTo = `${SITE_URL}/auth?invite=${inviteToken}`
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: effectiveRecipient,
      options: { redirectTo },
    } as any)
    const actionLink = (linkData as any)?.properties?.action_link || (linkData as any)?.action_link
    const hashedToken = (linkData as any)?.properties?.hashed_token
    const portalLink = actionLink || (hashedToken
      ? `${supabaseUrl}/auth/v1/verify?token=${hashedToken}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`
      : null)
    if (linkError || !portalLink) {
      console.error('Failed to generate fresh client invite magic link', { linkError, effectiveRecipient })
      return new Response(JSON.stringify({ error: 'Failed to generate a fresh portal access link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    templateData = {
      ...templateData,
      inviteToken,
      portalLink,
    }
  }

  const emailMetadata = (extra: Record<string, unknown> = {}) => ({
    ...(accountId ? { account_id: accountId } : {}),
    message_id: messageId,
    template_name: templateName,
    recipient: effectiveRecipient,
    templateData,
    ...extra,
  })

  if (!isServiceCaller) {
    // Authorization: staff (admin/producer) can send any template.
    // Clients can only trigger sends for their own account.
    const { data: callerRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUserId)
    const isStaff = (callerRoles ?? []).some(
      (r: { role: string }) => r.role === 'admin' || r.role === 'producer',
    )
    if (!isStaff) {
      // Client must own the account this email is being sent for
      if (!accountId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: ownedAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', accountId)
        .eq('client_user_id', callerUserId)
        .maybeSingle()
      if (!ownedAccount) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', {
      error: suppressionError,
      effectiveRecipient,
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      metadata: emailMetadata(),
    })

    console.log('Email suppressed', { effectiveRecipient, templateName })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Token lookup failed', {
      error: tokenLookupError,
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
      metadata: emailMetadata(),
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingToken && !existingToken.used_at) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      console.error('Failed to create unsubscribe token', {
        error: tokenError,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
        metadata: emailMetadata(),
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      console.error('Failed to read back unsubscribe token after upsert', {
        error: reReadError,
        email: normalizedEmail,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
        metadata: emailMetadata(),
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    console.warn('Unsubscribe token already used but email not suppressed', {
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
      metadata: emailMetadata(),
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Render React Email template to HTML and plain text
  let html = await renderAsync(
    React.createElement(template.component, templateData)
  )
  let plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true }
  )

  // Resolve subject — supports static string or dynamic function
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // Look up assigned producer email for visible CC line in client email
  let producerEmail: string | null = null
  let producerProducerId: string | null = null
  if (accountId) {
    try {
      const { data: acct } = await supabase
        .from('accounts')
        .select('assigned_producer_id')
        .eq('id', accountId)
        .single()
      if (acct?.assigned_producer_id) {
        producerProducerId = acct.assigned_producer_id
        const { data: prof } = await supabase
          .from('profiles')
          .select('email')
          .eq('user_id', acct.assigned_producer_id)
          .single()
        if (prof?.email && prof.email.toLowerCase() !== normalizedEmail) {
          producerEmail = prof.email.toLowerCase()
        }
      }
    } catch { /* non-fatal */ }
  }

  // Determine if producer should be CC'd / used as reply-to.
  // Suppress CC if producer is suppressed or has unsubscribed.
  let ccProducerEmail: string | null = null
  if (producerEmail) {
    try {
      const { data: producerSuppressed } = await supabase
        .from('suppressed_emails')
        .select('id')
        .eq('email', producerEmail)
        .maybeSingle()
      if (!producerSuppressed) {
        const { data: existingProdToken } = await supabase
          .from('email_unsubscribe_tokens')
          .select('used_at')
          .eq('email', producerEmail)
          .maybeSingle()
        if (!existingProdToken?.used_at) {
          ccProducerEmail = producerEmail
        }
      }
    } catch { /* non-fatal */ }
  }

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.
  const cc = ccProducerEmail ? [ccProducerEmail] : null

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  const { data: pendingLog } = await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
    metadata: emailMetadata({ cc }),
  }).select('id').maybeSingle()
  const emailLogId = pendingLog?.id ?? null

  const { data: queueId, error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
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
      templateData,
      ...(ccProducerEmail ? { cc: [ccProducerEmail], reply_to: [ccProducerEmail] } : {}),
      ...(accountId ? { account_id: accountId } : {}),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', {
      error: enqueueError,
      templateName,
      effectiveRecipient,
    })

    const enqueueErrorMessage = String(enqueueError?.message || enqueueError)
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
      metadata: emailMetadata({
        cc,
        email_log_id: emailLogId,
        error: enqueueErrorMessage,
      }),
    })

    if (accountId) {
      await supabase.from('activity_log').insert({
        account_id: accountId,
        action_type: 'email_failed',
        description: `Email '${templateName}' failed to queue for ${effectiveRecipient}`,
        metadata: emailMetadata({
          cc,
          email_log_id: emailLogId,
          error: enqueueErrorMessage,
        }),
      })
    }

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Transactional email enqueued', { templateName, effectiveRecipient })

  // Log enqueue success so staff see queued immediately in the account
  // timeline. process-email-queue will later log sent / failed once the
  // provider has dispatched (and update email_send_log with the provider
  // message_id).
  if (accountId) {
    await supabase.from('activity_log').insert({
      account_id: accountId,
      action_type: 'email_queued',
      description: `Email '${templateName}' queued for ${effectiveRecipient}${ccProducerEmail ? ` (cc ${ccProducerEmail})` : ''}`,
      metadata: emailMetadata({
        cc,
        queue_id: queueId ?? null,
        email_log_id: emailLogId,
      }),
    })
  }

  if (ccProducerEmail) {
    console.log(`Producer ${ccProducerEmail} CC'd and set as reply-to for ${effectiveRecipient}`)
  }

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
