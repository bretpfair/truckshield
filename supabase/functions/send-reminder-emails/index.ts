import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = '360 Risk Partners'
const SENDER_DOMAIN = 'notify.360riskpartners.com'
const FROM_DOMAIN = '360riskpartners.com'
const PORTAL_LINK = 'https://truckshield.360riskpartners.com/client'

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

// Server-side progress calculation — mirrors client-side calculateAccountProgress
function calculateServerProgress(
  account: any,
  powerUnits: any[],
  trailers: any[],
  drivers: any[],
  lossHistory: any[],
): number {
  const gq = (account.general_questions || {}) as any
  const cov = (account.coverage_selections || {}) as any
  const isNewVenture = !!gq.new_venture

  const isStep1Complete = !!(
    account.requested_effective_date &&
    account.dot_number && account.company_name &&
    account.ein_tax_id && account.business_type &&
    account.business_owner_name && account.business_owner_dob &&
    account.contact_email && account.contact_phone &&
    account.mailing_address && account.mailing_city && account.mailing_state && account.mailing_zip &&
    account.years_in_business != null &&
    (account.current_coverage_expiry || isNewVenture) &&
    (account.business_categories || []).length > 0 &&
    account.total_trucks != null && account.total_drivers != null
  )

  const isStep2Complete = !!(cov.primary_bipd && cov.icc_filing && cov.state_filing)

  const isStep3Complete = (() => {
    const r = (account.radius_operations as any)?.[0] || {}
    const details = r.radius_details || {}
    const total = ['under_50', '51_200', '201_500', '500_plus'].reduce(
      (s: number, k: string) => s + (parseFloat(details[k]) || 0), 0
    )
    return !!(r.operation_type && r.annual_mileage && total === 100)
  })()

  const isStep4Complete = (() => {
    const selected = (account.commodity_info as any)?.selected_commodities || {}
    const total = Object.values(selected).reduce((s: number, v: any) => s + (parseFloat(v) || 0), 0)
    return Object.keys(selected).length > 0 && total === 100
  })()

  const isStep5Complete = powerUnits.length > 0 &&
    powerUnits.every((u: any) => u.vin && u.year && u.make && u.truck_type && u.gvw_class && u.garage_zip && u.titled_state)

  const isStep6Complete = gq.no_trailers ||
    (trailers.length > 0 && trailers.every((t: any) => t.vin && t.year && t.make && t.trailer_type && t.garage_zip))

  const isStep7Complete = drivers.length > 0 &&
    drivers.every((d: any) =>
      d.first_name && d.last_name && d.date_of_birth &&
      d.license_number && d.license_state && d.license_type && d.driver_type &&
      d.original_issue_year && d.date_hired_year &&
      d.experience_years != null && d.lapse_suspension
    )

  const isStep8Complete = lossHistory.length > 0 || isNewVenture

  const isStep9Complete = (() => {
    const autoQs = ['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10','q11','q12','q13','q14','q15','q16','q17']
    const allAutoAnswered = autoQs.every(qId => {
      const q = gq[qId]
      if (!q) return false
      if (qId === 'q17') return q.value != null && q.value !== ''
      return q.answer === 'Yes' || q.answer === 'No'
    })
    const hasGL = cov.general_liability && cov.general_liability !== 'No Coverage'
    if (hasGL) {
      const glQs = ['gl1','gl2','gl3','gl4','gl5','gl6','gl7']
      return allAutoAnswered && glQs.every(qId => {
        const q = gq[qId]
        return q && (q.answer === 'Yes' || q.answer === 'No')
      })
    }
    return allAutoAnswered
  })()

  const sections = [
    isStep1Complete, isStep2Complete, isStep3Complete, isStep4Complete,
    isStep5Complete, isStep6Complete, isStep7Complete, isStep8Complete, isStep9Complete,
  ]
  return Math.round((sections.filter(Boolean).length / sections.length) * 100)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let appReminders = 0
  let notStartedReminders = 0
  let infoReminders = 0
  let inviteReminders = 0
  let firstLoginFollowups = 0

  try {
    // 1. Incomplete application reminders
    const { data: incompleteAccounts } = await supabase
      .from('accounts')
      .select('*, assigned_producer_id')
      .eq('status', 'pending_info')
      .not('client_user_id', 'is', null)

    if (incompleteAccounts && incompleteAccounts.length > 0) {
      const accountIds = incompleteAccounts.map((a: any) => a.id)
      const clientIds = incompleteAccounts.map((a: any) => a.client_user_id)
      const producerIds = [...new Set(incompleteAccounts.map((a: any) => a.assigned_producer_id).filter(Boolean))]

      // Batch-fetch related data, profiles, and producer profiles in parallel
      const fetchPromises: Promise<any>[] = [
        supabase.from('profiles').select('user_id, full_name, email').in('user_id', clientIds),
        supabase.from('power_units').select('account_id,vin,gvw_class,truck_type,year,make,garage_zip,titled_state').in('account_id', accountIds),
        supabase.from('trailers').select('account_id,vin,trailer_type,year,make,garage_zip').in('account_id', accountIds),
        supabase.from('drivers').select('account_id,first_name,last_name,date_of_birth,license_number,license_state,license_type,driver_type,original_issue_year,date_hired_year,experience_years,lapse_suspension').in('account_id', accountIds),
        supabase.from('loss_history').select('account_id,id').in('account_id', accountIds),
      ]
      if (producerIds.length > 0) {
        fetchPromises.push(supabase.from('profiles').select('user_id, email').in('user_id', producerIds))
      }

      const [profilesRes, puRes, trRes, drRes, lhRes, producerProfilesRes] = await Promise.all(fetchPromises)

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]))
      const producerEmailMap = new Map((producerProfilesRes?.data || []).map((p: any) => [p.user_id, p.email]))
      const powerUnitsAll = puRes.data || []
      const trailersAll = trRes.data || []
      const driversAll = drRes.data || []
      const lossHistoryAll = lhRes.data || []

      for (const account of incompleteAccounts) {
        const profile = profileMap.get(account.client_user_id)
        const email = profile?.email || account.contact_email
        if (!email) continue

        const step = account.application_step || 1
        const today = new Date().toISOString().split('T')[0]
        const producerEmail = account.assigned_producer_id ? producerEmailMap.get(account.assigned_producer_id) : undefined

        if (step <= 1) {
          const templateData = {
            firstName: profile?.full_name?.split(' ')[0] || undefined,
            companyName: account.company_name,
            portalLink: PORTAL_LINK,
          }
          await enqueueEmail(supabase, 'application-not-started', email, templateData, `app-not-started-${account.id}-${today}`)
          notStartedReminders++
          // CC producer
          if (producerEmail && producerEmail.toLowerCase() !== email.toLowerCase()) {
            await enqueueEmail(supabase, 'application-not-started', producerEmail, templateData, `app-not-started-${account.id}-${today}-producer-cc`)
          }
        } else {
          const pu = powerUnitsAll.filter((u: any) => u.account_id === account.id)
          const tr = trailersAll.filter((t: any) => t.account_id === account.id)
          const dr = driversAll.filter((d: any) => d.account_id === account.id)
          const lh = lossHistoryAll.filter((l: any) => l.account_id === account.id)
          const completionPercent = calculateServerProgress(account, pu, tr, dr, lh).toString()

          const templateData = {
            firstName: profile?.full_name?.split(' ')[0] || undefined,
            companyName: account.company_name,
            completionPercent,
            portalLink: PORTAL_LINK,
          }
          await enqueueEmail(supabase, 'application-reminder', email, templateData, `app-reminder-${account.id}-${today}`)
          appReminders++
          // CC producer
          if (producerEmail && producerEmail.toLowerCase() !== email.toLowerCase()) {
            await enqueueEmail(supabase, 'application-reminder', producerEmail, templateData, `app-reminder-${account.id}-${today}-producer-cc`)
          }
        }
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
        .select('id, company_name, client_user_id, contact_email, assigned_producer_id')
        .in('id', accountIds)
        .not('client_user_id', 'is', null)

      const accountMap = new Map((accounts || []).map((a: any) => [a.id, a]))

      const clientIds = (accounts || []).map((a: any) => a.client_user_id).filter(Boolean)
      const infoProducerIds = [...new Set((accounts || []).map((a: any) => a.assigned_producer_id).filter(Boolean))]
      const allUserIds = [...new Set([...clientIds, ...infoProducerIds])]

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', allUserIds)
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
        const templateData = {
          firstName: profile?.full_name?.split(' ')[0] || undefined,
          companyName: account.company_name,
          carrierName: request.carrier_name,
          requestDetails: request.request_details,
          daysPending,
          portalLink: PORTAL_LINK,
        }
        await enqueueEmail(supabase, 'info-request-reminder', email, templateData, `info-reminder-${request.id}-${today}`)
        infoReminders++

        // CC producer
        const producerProfile = account.assigned_producer_id ? profileMap.get(account.assigned_producer_id) : undefined
        const producerEmail = producerProfile?.email
        if (producerEmail && producerEmail.toLowerCase() !== email.toLowerCase()) {
          await enqueueEmail(supabase, 'info-request-reminder', producerEmail, templateData, `info-reminder-${request.id}-${today}-producer-cc`)
        }
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
        .select('id, company_name, client_user_id, assigned_producer_id')
        .in('id', inviteAccountIds)

      const inviteAccountMap = new Map((inviteAccounts || []).map((a: any) => [a.id, a]))

      // Fetch producer emails for invite accounts
      const invProducerIds = [...new Set((inviteAccounts || []).map((a: any) => a.assigned_producer_id).filter(Boolean))]
      let invProducerEmailMap = new Map<string, string>()
      if (invProducerIds.length > 0) {
        const { data: invProducerProfiles } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', invProducerIds)
        invProducerEmailMap = new Map((invProducerProfiles || []).map((p: any) => [p.user_id, p.email]))
      }

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
        const templateData = {
          firstName,
          portalLink,
          companyName: account.company_name,
          daysSinceInvite: daysSinceInvite.toString(),
        }
        await enqueueEmail(supabase, 'invite-reminder', invite.email, templateData, `invite-reminder-${invite.id}-${today}`)
        inviteReminders++

        // CC producer
        const producerEmail = account.assigned_producer_id ? invProducerEmailMap.get(account.assigned_producer_id) : undefined
        if (producerEmail && producerEmail.toLowerCase() !== invite.email.toLowerCase()) {
          await enqueueEmail(supabase, 'invite-reminder', producerEmail, templateData, `invite-reminder-${invite.id}-${today}-producer-cc`)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        applicationReminders: appReminders,
        notStartedReminders,
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
