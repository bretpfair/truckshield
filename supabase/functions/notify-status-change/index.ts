import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = "TruckShield"
const SENDER_DOMAIN = "truckshield.360riskpartners.com"
const FROM_DOMAIN = "truckshield.360riskpartners.com"

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

async function logEmailActivity(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  description: string
) {
  const { error } = await supabase.from('activity_log').insert({
    account_id: accountId,
    action_type: 'email_failed',
    description,
  })

  if (error) {
    console.error('Failed to write email activity log', { accountId, description, error })
  }
}

async function enqueueEmailForRecipient(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  recipientEmail: string,
  templateName: string,
  templateData: Record<string, any>,
  idempotencySuffix: string,
  options?: { cc?: string | null; replyTo?: string | null }
) {
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error(`Template "${templateName}" not found`)
    return
  }

  // Check suppression
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', recipientEmail.toLowerCase())
    .maybeSingle()

  if (suppressed) {
    await logEmailActivity(supabase, accountId, `Email "${templateName}" was not sent because ${recipientEmail} is suppressed.`)
    return
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
    await logEmailActivity(supabase, accountId, `Email "${templateName}" was not sent because ${recipientEmail} has unsubscribed.`)
    return
  }

  const messageId = crypto.randomUUID()
  const idempotencyKey = `${idempotencySuffix}-${Date.now()}`

  const html = await renderAsync(React.createElement(template.component, templateData))
  const plainText = await renderAsync(React.createElement(template.component, templateData), { plainText: true })
  const resolvedSubject = typeof template.subject === 'function' ? template.subject(templateData) : template.subject

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: recipientEmail,
    status: 'pending',
    metadata: {
      account_id: accountId,
      account_name: templateData.companyName || templateData.company_name,
    },
  })

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
      account_id: accountId,
      ...(options?.cc ? { cc: [options.cc] } : {}),
      ...(options?.replyTo ? { reply_to: [options.replyTo] } : {}),
    },
  })

  if (enqueueError) {
    await logEmailActivity(supabase, accountId, `Email "${templateName}" failed to queue for ${recipientEmail}.`)
    console.error('Failed to enqueue email', enqueueError)
  } else {
    console.log(`Email "${templateName}" enqueued for ${recipientEmail}`)
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

  const { data: account, error: acctErr } = await supabase
    .from('accounts')
    .select('contact_email, company_name, client_user_id, assigned_producer_id, dot_number')
    .eq('id', accountId)
    .single()

  if (acctErr || !account) {
    console.log('Account not found', { accountId, acctErr })
    return new Response(JSON.stringify({ success: false, reason: 'account_not_found' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // --- Send client notification (pipeline-status-change) ---
  if (account.contact_email) {
    let firstName: string | undefined
    if (account.client_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', account.client_user_id)
        .single()
      firstName = profile?.full_name?.split(' ')[0]
    }

    const templateData = {
      firstName,
      companyName: account.company_name,
      newStatus,
      portalLink: 'https://truckshield.360riskpartners.com/client',
    }

    await enqueueEmailForRecipient(
      supabase,
      accountId,
      account.contact_email,
      'pipeline-status-change',
      templateData,
      `auto-pipeline-${accountId}-${newStatus}`
    )

    // CC the assigned producer on the client email
    if (account.assigned_producer_id) {
      const { data: producerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', account.assigned_producer_id)
        .single()

      if (producerProfile?.email && producerProfile.email.toLowerCase() !== account.contact_email.toLowerCase()) {
        await enqueueEmailForRecipient(
          supabase,
          accountId,
          producerProfile.email,
          'pipeline-status-change',
          templateData,
          `auto-pipeline-${accountId}-${newStatus}-producer-cc`
        )
      }
    }
  } else {
    await logEmailActivity(supabase, accountId, `Email "pipeline-status-change" could not be sent because no client email is on file.`)
  }

  // --- Send staff notification on application completion (info_complete) ---
  if (newStatus === 'info_complete') {
    // Gather submitter name
    let submittedBy: string | undefined
    if (account.client_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', account.client_user_id)
        .single()
      submittedBy = profile?.full_name || profile?.email || undefined
    }

    const staffTemplateData = {
      companyName: account.company_name,
      dotNumber: account.dot_number,
      submittedBy,
      portalLink: `https://truckshield.360riskpartners.com`,
    }

    // Collect staff emails to notify: all admins + assigned producer
    const staffEmails: Set<string> = new Set()

    // Get all admin user IDs
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')

    const adminUserIds = adminRoles?.map((r) => r.user_id) || []

    // Add assigned producer
    const allStaffIds = [...new Set([...adminUserIds, ...(account.assigned_producer_id ? [account.assigned_producer_id] : [])])]

    if (allStaffIds.length > 0) {
      const { data: staffProfiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', allStaffIds)

      for (const profile of staffProfiles || []) {
        if (profile.email) {
          staffEmails.add(profile.email)
        }
      }
    }

    // Send to each staff member
    for (const email of staffEmails) {
      await enqueueEmailForRecipient(
        supabase,
        accountId,
        email,
        'application-completed-staff',
        staffTemplateData,
        `app-completed-staff-${accountId}-${email}`
      )
    }
  }

  // --- Send "Quotes Ready" email when status moves to "quoted" ---
  if (newStatus === 'quoted' && account.contact_email) {
    let firstName: string | undefined
    if (account.client_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', account.client_user_id)
        .single()
      firstName = profile?.full_name?.split(' ')[0]
    }

    const quotesData = {
      firstName,
      companyName: account.company_name,
      portalLink: 'https://truckshield.360riskpartners.com/client',
    }

    await enqueueEmailForRecipient(
      supabase, accountId, account.contact_email,
      'quotes-ready-urgency', quotesData,
      `quotes-ready-${accountId}`
    )

    // CC producer
    if (account.assigned_producer_id) {
      const { data: prodProf } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', account.assigned_producer_id)
        .single()
      if (prodProf?.email && prodProf.email.toLowerCase() !== account.contact_email.toLowerCase()) {
        await enqueueEmailForRecipient(
          supabase, accountId, prodProf.email,
          'quotes-ready-urgency', quotesData,
          `quotes-ready-${accountId}-producer-cc`
        )
      }
    }
  }

  // --- Send "Post-Bind Welcome" email when status moves to "bound" ---
  if (newStatus === 'bound' && account.contact_email) {
    let firstName: string | undefined
    if (account.client_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', account.client_user_id)
        .single()
      firstName = profile?.full_name?.split(' ')[0]
    }

    const bindData = {
      firstName,
      companyName: account.company_name,
      portalLink: 'https://truckshield.360riskpartners.com/client',
    }

    await enqueueEmailForRecipient(
      supabase, accountId, account.contact_email,
      'post-bind-welcome', bindData,
      `post-bind-${accountId}`
    )

    // CC producer
    if (account.assigned_producer_id) {
      const { data: prodProf } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', account.assigned_producer_id)
        .single()
      if (prodProf?.email && prodProf.email.toLowerCase() !== account.contact_email.toLowerCase()) {
        await enqueueEmailForRecipient(
          supabase, accountId, prodProf.email,
          'post-bind-welcome', bindData,
          `post-bind-${accountId}-producer-cc`
        )
      }
    }
  }

  console.log('Status change notifications processed', { accountId, newStatus })
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
