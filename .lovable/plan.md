

# Plan: Implement Automated Alerts v2 + Polished Email Body Copies

## Summary
1. Align all email templates with the revised TruckShield Automated Alerts v2 specification (subjects, triggers, recipients)
2. **NEW: Update all 11 email templates with polished body copy** — exact text provided by user for all transactional and reminder emails
3. Remove Task Digest entirely
4. Fix bidirectional new-message behavior
5. Regenerate the reference document with updated body summaries

## Part 1: Polished Email Body Copies (NEW)

Update the body content (JSX/HTML) for all 11 templates with exact polished text. Keep subjects, placeholders, and logic unchanged.

| Template | Key Body Changes |
|----------|-----------------|
| client-portal-invite.tsx | Welcome to TruckShield, bullet list (complete app, upload docs, track quotes, message team), "Access Your Portal →" CTA |
| application-received.tsx | Thank you confirmation, team reviewing, "View Your Portal" link, best regards |
| application-completed-staff.tsx | Simplified: "Application Completed — {companyName}", DOT #, submitter, "View Full Application →" CTA |
| pipeline-status-change.tsx | "moved to the {newStatus} stage", {statusExplanation}, "View Current Status →" CTA |
| carrier-status-change.tsx | "{carrierName} has updated the status...to {status}", {statusDetails}, "View Full Details in Portal →" CTA |
| additional-info-request.tsx | "Action Required:" header, "Details requested:" highlighted box, "Respond Now →" CTA |
| new-message-received.tsx | "You have a new message regarding {companyName}", Message preview in quotes, "View & Reply →" CTA |
| application-not-started.tsx | "Your TruckShield insurance application...is ready and waiting", "Start Your Application Now →" CTA |
| application-reminder.tsx | "{completionPercentage}% complete", encouraging progress message, "Continue Your Application →" CTA |
| info-request-reminder.tsx | "Friendly Reminder:" carrier waiting {daysPending} days, "Respond Now →" CTA |
| invite-reminder.tsx | "Your portal is ready and waiting — it only takes one click", "Access Your Portal Now →" CTA |

## Part 2: Previously Approved v2 Changes

### Remove Task Digest
- Delete `task-digest.tsx`
- Remove from `registry.ts`
- Remove Section 4 from `send-reminder-emails/index.ts`

### Update Subjects
| Template | New Subject |
|----------|-------------|
| client-portal-invite | "Access Your TruckShield Client Portal — 360 Risk Partners" |
| carrier-status-change | "{Carrier Name} Quote Update — {Status}" |
| application-received | "Application received — our team is on it" |
| application-completed-staff | "Application completed — {Company Name}" |
| application-not-started | "Your Insurance Application is Waiting — 360 Risk Partners" |
| application-reminder | "Complete Your Application — 360 Risk Partners" |

### Bidirectional New Message
- Update `AccountMessages.tsx` so client messages notify **all admins + assigned producer**

## Files Modified
- supabase/functions/_shared/transactional-email-templates/client-portal-invite.tsx
- supabase/functions/_shared/transactional-email-templates/application-received.tsx
- supabase/functions/_shared/transactional-email-templates/application-completed-staff.tsx
- supabase/functions/_shared/transactional-email-templates/pipeline-status-change.tsx
- supabase/functions/_shared/transactional-email-templates/carrier-status-change.tsx
- supabase/functions/_shared/transactional-email-templates/additional-info-request.tsx
- supabase/functions/_shared/transactional-email-templates/new-message-received.tsx
- supabase/functions/_shared/transactional-email-templates/application-not-started.tsx
- supabase/functions/_shared/transactional-email-templates/application-reminder.tsx
- supabase/functions/_shared/transactional-email-templates/info-request-reminder.tsx
- supabase/functions/_shared/transactional-email-templates/invite-reminder.tsx
- supabase/functions/_shared/transactional-email-templates/registry.ts
- supabase/functions/_shared/transactional-email-templates/task-digest.tsx — DELETE
- supabase/functions/send-reminder-emails/index.ts
- src/components/messaging/AccountMessages.tsx
- /mnt/documents/TruckShield_Automated_Alerts_v2.md — REGENERATE

## Deployment
- Deploy: `send-transactional-email`, `send-reminder-emails`, `notify-status-change`, `preview-transactional-email`

