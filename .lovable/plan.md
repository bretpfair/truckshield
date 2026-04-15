

# Plan: Implement Automated Alerts v2 Updates

## Summary
Align all email templates, edge functions, and registry with the revised TruckShield Automated Alerts v2 specification. Remove Task Digest entirely, update subjects/copy across all templates, fix carrier status dynamic subjects, ensure bidirectional new-message behavior, and regenerate the reference document.

## Changes

### 1. Remove Task Digest (template + cron logic + registry)
- **Delete** `supabase/functions/_shared/transactional-email-templates/task-digest.tsx`
- **Remove** the `task-digest` import and registry entry from `registry.ts`
- **Remove** the entire "Section 4: Task digest reminders" block (lines 439-501) from `send-reminder-emails/index.ts`, plus the `taskDigests` counter and its inclusion in the response

### 2. Update Template Subjects & Copy

| Template | Current Subject | New Subject |
|----------|----------------|-------------|
| `client-portal-invite` | "Your Client Portal is Ready — 360 Risk Partners" | "Access Your TruckShield Client Portal — 360 Risk Partners" |
| `carrier-status-change` | `{carrierName} — {label}` | `{Carrier Name} Quote Update — {Status}` (e.g. "Great West Quote Update — Quoted") |
| `application-received` | "Application Received — 360 Risk Partners" | "Application received — our team is on it" |
| `application-completed-staff` | `Application Completed: {companyName}` | `Application completed — {Company Name}` |
| `application-not-started` | "Get started: Complete your application..." | "Your Insurance Application is Waiting — 360 Risk Partners" |
| `application-reminder` | "Reminder: Complete your application..." | "Complete Your Application — 360 Risk Partners" |

### 3. Fix Bidirectional New Message Behavior
The current code only sends email to one admin when a client messages. Per v2 spec, client messages should notify **all admins + assigned producer** via email (not just one admin). Update `AccountMessages.tsx` to:
- When client sends: email all admins + assigned producer (loop over admin roles + producer)
- When staff sends: email client (already works correctly)

### 4. Update `send-reminder-emails/index.ts`
- Remove task digest section entirely
- Remove `taskDigests` from response object

### 5. Regenerate Documentation
- Write updated `/mnt/documents/TruckShield_Automated_Alerts_v2.md` with the final state matching all implemented changes

### 6. Deploy Edge Functions
Redeploy: `send-reminder-emails`, `notify-status-change`, `send-transactional-email`, `preview-transactional-email`

## Files Modified
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — remove task-digest
- `supabase/functions/_shared/transactional-email-templates/task-digest.tsx` — delete
- `supabase/functions/_shared/transactional-email-templates/client-portal-invite.tsx` — new subject
- `supabase/functions/_shared/transactional-email-templates/carrier-status-change.tsx` — new subject format
- `supabase/functions/_shared/transactional-email-templates/application-received.tsx` — subject tweak
- `supabase/functions/_shared/transactional-email-templates/application-completed-staff.tsx` — subject tweak
- `supabase/functions/_shared/transactional-email-templates/application-not-started.tsx` — new subject
- `supabase/functions/_shared/transactional-email-templates/application-reminder.tsx` — new subject
- `supabase/functions/send-reminder-emails/index.ts` — remove task digest section
- `src/components/messaging/AccountMessages.tsx` — bidirectional email to all admins + producer
- `/mnt/documents/TruckShield_Automated_Alerts_v2.md` — regenerated

