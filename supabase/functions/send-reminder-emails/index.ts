import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = '360 Risk Partners'
const SENDER_DOMAIN = 'notify.360riskpartners.com'
const FROM_DOMAIN = '360riskpartners.com'
const PORTAL_LINK = 'https://truckshield.lovable.app/client'

// Send reminders every 3 days (don't spam daily)
const REMINDER_INTERVAL_DAYS = 3

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

async function enqueueEmail(
  supabase: any,
  templateName: string,
  recipientEmail: string,
  templateData: Record<string, any>,
  idempotencyKey: string,
) {
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error(`Template ${templateName} not found`)
    return
  }

  const normalizedEmail = recipientEmail.toLowerCase()

  // Check suppression
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (suppressed) {
    console.log(`Skipping suppressed email: ${normalizedEmail}`)
    return
  }

  // Check for recent reminder in email_send_log to avoid duplicates
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - REMINDER_INTERVAL_DAYS)
  const { data: recentSend } = await supabase
    .from('email_send_log')
    .select('id')
    .eq('template_name', templateName)
    .eq('recipient_email', normalizedEmail)
    .gte('created_at', cutoffDate.toISOString())
    .in('status', ['pending', 'sent'])
    .limit(1)

  if (recentSend && recentSend.length > 0) {
    console.log(`Skipping ${templateName} for ${normalizedEmail} — sent within last ${REMINDER_INTERVAL_DAYS} days`)
    return
  }

  // Get or create unsubscribe token
  let unsubscribeToken: string
  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingToken?.used_at) {
    console.log(`Skipping ${normalizedEmail} — unsubscribed`)
    return
  }

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true })

    const { data: storedToken } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    unsubscribeToken = storedToken?.token || unsubscribeToken
  }

  // Render
  const html = await renderAsync(React.createElement(template.component, templateData))
  const plainText = await renderAsync(React.createElement(template.component, templateData), { plainText: true })
  const resolvedSubject = typeof template.subject === 'function' ? template.subject(templateData) : template.subject
  const messageId = crypto.randomUUID()

  // Log pending
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: normalizedEmail,
    status: 'pending',
  })

  // Enqueue
  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: normalizedEmail,
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

  if (error) {
    console.error(`Failed to enqueue ${templateName} for ${normalizedEmail}:`, error)
  } else {
    console.log(`Enqueued ${templateName} for ${normalizedEmail}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let appReminders = 0
  let infoReminders = 0
  let inviteReminders = 0

  try {
    // 1. Incomplete application reminders
    // Find accounts with a linked client that are still in pending_info status
    const { data: incompleteAccounts } = await supabase
      .from('accounts')
      .select('id, company_name, client_user_id, contact_email, application_step')
      .eq('status', 'pending_info')
      .not('client_user_id', 'is', null)

    if (incompleteAccounts && incompleteAccounts.length > 0) {
      // Get profiles for client names/emails
      const clientIds = incompleteAccounts.map((a: any) => a.client_user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', clientIds)

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]))

      for (const account of incompleteAccounts) {
        const profile = profileMap.get(account.client_user_id)
        const email = profile?.email || account.contact_email
        if (!email) continue

        const completionPercent = account.application_step
          ? Math.round(((account.application_step - 1) / 10) * 100).toString()
          : '0'

        const today = new Date().toISOString().split('T')[0]
        await enqueueEmail(supabase, 'application-reminder', email, {
          firstName: profile?.full_name?.split(' ')[0] || undefined,
          companyName: account.company_name,
          completionPercent,
          portalLink: PORTAL_LINK,
        }, `app-reminder-${account.id}-${today}`)
        appReminders++
      }
    }

    // 2. Info request reminders
    // Find pending info_requests and send reminders to the client
    const { data: pendingRequests } = await supabase
      .from('info_requests')
      .select('id, account_id, carrier_name, request_details, created_at, quote_id')
      .eq('status', 'pending')

    if (pendingRequests && pendingRequests.length > 0) {
      const accountIds = [...new Set(pendingRequests.map((r: any) => r.account_id))]
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, company_name, client_user_id, contact_email')
        .in('id', accountIds)
        .not('client_user_id', 'is', null)

      const accountMap = new Map((accounts || []).map((a: any) => [a.id, a]))

      const clientIds = (accounts || []).map((a: any) => a.client_user_id).filter(Boolean)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', clientIds)
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]))

      for (const request of pendingRequests) {
        const account = accountMap.get(request.account_id)
        if (!account) continue

        const profile = profileMap.get(account.client_user_id)
        const email = profile?.email || account.contact_email
        if (!email) continue

        const daysPending = Math.floor(
          (Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24)
        ).toString()

        const today = new Date().toISOString().split('T')[0]
        await enqueueEmail(supabase, 'info-request-reminder', email, {
          firstName: profile?.full_name?.split(' ')[0] || undefined,
          companyName: account.company_name,
          carrierName: request.carrier_name,
          requestDetails: request.request_details,
          daysPending,
          portalLink: PORTAL_LINK,
        }, `info-reminder-${request.id}-${today}`)
        infoReminders++
      }
    }

    // 3. Invite follow-up reminders
    // Find pending invitations where the client hasn't signed up yet
    const { data: pendingInvites } = await supabase
      .from('client_invitations')
      .select('id, account_id, email, token, created_at, expires_at')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (pendingInvites && pendingInvites.length > 0) {
      const inviteAccountIds = [...new Set(pendingInvites.map((i: any) => i.account_id))]
      const { data: inviteAccounts } = await supabase
        .from('accounts')
        .select('id, company_name, client_user_id')
        .in('id', inviteAccountIds)

      const inviteAccountMap = new Map((inviteAccounts || []).map((a: any) => [a.id, a]))

      for (const invite of pendingInvites) {
        const account = inviteAccountMap.get(invite.account_id)
        // Skip if account already has a linked client (invite accepted via different path)
        if (!account || account.client_user_id) continue

        const daysSinceInvite = Math.floor(
          (Date.now() - new Date(invite.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )

        // Only send reminders if at least 1 day has passed since invite
        if (daysSinceInvite < 1) continue

        const portalLink = `${PORTAL_LINK.replace('/client', '')}/auth?invite=${invite.token}`
        const firstName = invite.email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase())

        const today = new Date().toISOString().split('T')[0]
        await enqueueEmail(supabase, 'invite-reminder', invite.email, {
          firstName,
          portalLink,
          companyName: account.company_name,
          daysSinceInvite: daysSinceInvite.toString(),
        }, `invite-reminder-${invite.id}-${today}`)
        inviteReminders++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        applicationReminders: appReminders,
        infoRequestReminders: infoReminders,
        inviteReminders,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-reminder-emails:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
