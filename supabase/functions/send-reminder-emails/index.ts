import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = '360 Risk Partners'
const SENDER_DOMAIN = 'truckshield.360riskpartners.com'
const FROM_DOMAIN = 'truckshield.360riskpartners.com'
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
  options?: { cc?: string | null; replyTo?: string | null; accountId?: string; metadata?: Record<string, any> },
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
  const pendingMetadata: Record<string, any> = { ...(options?.metadata || {}) }
  if (options?.accountId) pendingMetadata.account_id = options.accountId
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: normalizedEmail,
    status: 'pending',
    metadata: Object.keys(pendingMetadata).length ? pendingMetadata : null,
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
      ...(options?.accountId ? { account_id: options.accountId } : {}),
      ...(options?.cc ? { cc: [options.cc.toLowerCase()] } : {}),
      ...(options?.replyTo ? { reply_to: [options.replyTo.toLowerCase()] } : {}),
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

  // Service-role auth: only callable from cron / internal triggers using the service role key.
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.replace('Bearer ', '') !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let appReminders = 0
  let notStartedReminders = 0
  let infoReminders = 0
  let inviteReminders = 0
  let firstLoginFollowups = 0

  try {
    // 14-day inactivity cutoff — stop sending progress/reminder emails once
    // the account hasn't been touched for 14 days.
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Incomplete application reminders
    const { data: incompleteAccounts } = await supabase
      .from('accounts')
      .select('*, assigned_producer_id')
      .eq('status', 'pending_info')
      .not('client_user_id', 'is', null)
      .gte('updated_at', fourteenDaysAgo)

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

        const firstName = profile?.full_name?.split(' ')[0] || undefined
        const cc = producerEmail && producerEmail.toLowerCase() !== email.toLowerCase() ? producerEmail : null

        // Send AT MOST one progress email per account per cron run, in priority order:
        //   1) application-not-started (step <= 1)
        //   2) application-milestone (new 25/50/75 crossed, never previously sent)
        //   3) application-reminder (general progress nudge)
        if (step <= 1) {
          const templateData = { firstName, companyName: account.company_name, portalLink: PORTAL_LINK }
          await enqueueEmail(supabase, 'application-not-started', email, templateData, `app-not-started-${account.id}-${today}`, { cc, replyTo: cc })
          notStartedReminders++
          continue
        }

        const pu = powerUnitsAll.filter((u: any) => u.account_id === account.id)
        const tr = trailersAll.filter((t: any) => t.account_id === account.id)
        const dr = driversAll.filter((d: any) => d.account_id === account.id)
        const lh = lossHistoryAll.filter((l: any) => l.account_id === account.id)
        const progress = calculateServerProgress(account, pu, tr, dr, lh)

        // Highest milestone crossed (25/50/75 only; 100 is application-complete, not a milestone).
        const milestone = Math.min(75, Math.floor(progress / 25) * 25)
        let milestoneSent = false
        if (milestone >= 25) {
          const normalizedEmail = email.toLowerCase()
          // Lifetime dedupe — each milestone fires at most once per account, ever.
          const { data: priorMilestone } = await supabase
            .from('email_send_log')
            .select('id')
            .eq('template_name', 'application-milestone')
            .eq('recipient_email', normalizedEmail)
            .contains('metadata', { account_id: account.id, milestone: milestone })
            .in('status', ['pending', 'sent'])
            .limit(1)

          if (!priorMilestone || priorMilestone.length === 0) {
            const ownerName = account.business_owner_name || ''
            const templateData = {
              firstName: firstName || ownerName.split(' ')[0] || undefined,
              companyName: account.company_name,
              completionPercentage: milestone.toString(),
              portalLink: PORTAL_LINK,
            }
            await enqueueEmail(
              supabase,
              'application-milestone',
              email,
              templateData,
              `app-milestone-${account.id}-${milestone}`,
              { cc, replyTo: cc, accountId: account.id, metadata: { milestone } },
            )
            milestoneSent = true
            appReminders++
          }
        }

        if (milestoneSent) continue

        // Fall back to generic progress reminder.
        const templateData = {
          firstName,
          companyName: account.company_name,
          completionPercent: progress.toString(),
          portalLink: PORTAL_LINK,
        }
        await enqueueEmail(supabase, 'application-reminder', email, templateData, `app-reminder-${account.id}-${today}`, { cc, replyTo: cc })
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
        const producerProfile = account.assigned_producer_id ? profileMap.get(account.assigned_producer_id) : undefined
        const producerEmail = producerProfile?.email
        const cc = producerEmail && producerEmail.toLowerCase() !== email.toLowerCase() ? producerEmail : null
        await enqueueEmail(supabase, 'info-request-reminder', email, templateData, `info-reminder-${request.id}-${today}`, { cc, replyTo: cc })
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
        const producerEmail = account.assigned_producer_id ? invProducerEmailMap.get(account.assigned_producer_id) : undefined
        const cc = producerEmail && producerEmail.toLowerCase() !== invite.email.toLowerCase() ? producerEmail : null
        await enqueueEmail(supabase, 'invite-reminder', invite.email, templateData, `invite-reminder-${invite.id}-${today}`, { cc, replyTo: cc })
        inviteReminders++
      }
    }

    // 4. First-login Day-3 follow-up reminders
    // Find accounts where client logged in for the first time ~3 days ago but application hasn't progressed
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const fourDaysAgo = new Date()
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)

    const { data: firstLoginAccounts } = await supabase
      .from('activity_log')
      .select('account_id, created_at')
      .eq('action_type', 'client_login')
      .eq('description', 'Client signed into the portal for the first time')
      .gte('created_at', fourDaysAgo.toISOString())
      .lte('created_at', threeDaysAgo.toISOString())

    if (firstLoginAccounts && firstLoginAccounts.length > 0) {
      const flAccountIds = [...new Set(firstLoginAccounts.map((a: any) => a.account_id))]
      const { data: flAccounts } = await supabase
        .from('accounts')
        .select('id, company_name, client_user_id, contact_email, assigned_producer_id, application_step')
        .in('id', flAccountIds)
        .not('client_user_id', 'is', null)

      if (flAccounts) {
        // Only send follow-up if application hasn't progressed past step 2
        const stagnantAccounts = flAccounts.filter((a: any) => (a.application_step || 1) <= 2)

        const flClientIds = stagnantAccounts.map((a: any) => a.client_user_id).filter(Boolean)
        const flProducerIds = [...new Set(stagnantAccounts.map((a: any) => a.assigned_producer_id).filter(Boolean))]
        const flAllIds = [...new Set([...flClientIds, ...flProducerIds])]

        let flProfileMap = new Map<string, any>()
        if (flAllIds.length > 0) {
          const { data: flProfiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', flAllIds)
          flProfileMap = new Map((flProfiles || []).map((p: any) => [p.user_id, p]))
        }

        const today = new Date().toISOString().split('T')[0]
        for (const acct of stagnantAccounts) {
          const profile = flProfileMap.get(acct.client_user_id)
          const email = profile?.email || acct.contact_email
          if (!email) continue

          const templateData = {
            firstName: profile?.full_name?.split(' ')[0] || undefined,
            companyName: acct.company_name,
            portalLink: PORTAL_LINK,
          }
          const producerProfile = acct.assigned_producer_id ? flProfileMap.get(acct.assigned_producer_id) : undefined
          const producerEmail = producerProfile?.email
          const cc = producerEmail && producerEmail.toLowerCase() !== email.toLowerCase() ? producerEmail : null
          await enqueueEmail(supabase, 'application-not-started', email, templateData, `first-login-followup-${acct.id}-${today}`, { cc, replyTo: cc })
          firstLoginFollowups++
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
        firstLoginFollowups,
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
