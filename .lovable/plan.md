## Goal

Fix the broken invite + notification chain: invite link auto-authenticates → invite email persists to `accounts.contact_email` → downstream notifications use it and log delivery → account header refreshes after mutations → expired/invalid invites have a clear recovery path.

## 1. Auto-invite email must use a real magic link

**Problem.** `send-portal-invite-on-assignment` (fired by the producer-assignment trigger) sends a plain `/auth?invite={token}` URL — it pre-fills the email but does not create a session. Only the manual UI path uses `create-client-magic-link`.

**Fix.** Refactor `supabase/functions/send-portal-invite-on-assignment/index.ts` to generate a true magic link with the service role (`auth.admin.generateLink({ type: "magiclink", email, options: { email_redirect_to: "https://truckshield.360riskpartners.com/auth?invite={token}" } })`). Use the returned verify URL as `portalLink` in the template data. The `email_redirect_to` preserves invitation context so `Auth.tsx` can call `accept_invitation(p_token)` after authentication and route the user to `/client`. If generation fails, fall back to the plain `/auth?invite=...` URL and log the fallback clearly.

## 2. Persist invite email to `accounts.contact_email`

**Problem.** Manual invite paths (`src/lib/sendClientInvite.ts`, `src/components/staff/InviteClientDialog.tsx`) create the invitation but never write the email to `accounts.contact_email`. All downstream notifications gate on that field.

**Fix.**
- After a successful invitation insert in both files, update the account:
  ```sql
  UPDATE accounts
  SET contact_email = <invite email>
  WHERE id = <accountId>
    AND (contact_email IS NULL OR contact_email = '');
  ```
- New migration: update `accept_invitation(p_token)` to backfill `accounts.contact_email` from `auth.jwt()->>'email'` when the account's contact email is still null/empty at acceptance.

Never overwrite an existing contact email.

## 3. Additional Info Request email + activity logging

**Problem.** The "Additional Info Requested" flow depends on `account.contact_email` (now fixed by #2). Separately, `send-transactional-email` writes only to `email_send_log`, never `activity_log`, so staff cannot see whether a transactional email was queued or failed from the account timeline.

**Fix.**
- In `supabase/functions/send-transactional-email/index.ts`, after a successful `enqueue_email` (and when `accountId` is provided), insert an `activity_log` row with `action_type: "email_sent"`, a description that includes template name + recipient + CC if present, and metadata with `template_name`, `recipient`, `cc`, `queue_id` or `email_log_id`. On enqueue failure, insert `action_type: "email_failed"` with the error. The provider `message_id` does not exist at enqueue time — `process-email-queue` should update `email_send_log` with the provider `message_id` once the email is dispatched through Resend.
- In `supabase/functions/notify-status-change/index.ts`, replace the existing `logEmailActivity` (failure-only) with a unified helper that logs both success and failure with the same shape.
- Verify `supabase/functions/process-email-queue/index.ts` updates `email_send_log` with provider `message_id` on success and error string on failure/DLQ; add if missing.

## 4. Instant account header refresh

**Problem.** Quote/status mutations trigger a DB-level `auto_update_account_status` flip on `accounts.status`, but `SubmittedMarkets` only invalidates `["quotes"]` and `["activity_log"]`, leaving the account header stale until reload.

**Fix.** In `src/components/staff/SubmittedMarkets.tsx`, every success path (`updateStatus`, `handleSubmitDecline`, `handleSubmitInfoRequest`, `handleUploadQuote`, `handleSubmitBind`, `handleUpdateQuote`, and any "Mark as Submitted" handler) must also invalidate `["account", accountId]` and `["accounts"]`. Apply the same set in `src/components/staff/CoverWhaleActions.tsx`. Audit `AccountDetail.tsx` for the exact query key and align.

## 5. Expired / invalid invite UX

**Problem.** If `accept_invitation` returns `{ error: ... }` (e.g. wrong logged-in email), the page still navigates. "Send me a new link" uses raw `signInWithOtp`, not an invite-bound magic link.

**Fix.** In `src/pages/Auth.tsx`, on an `accept_invitation` error: do not navigate, set `inviteStatus` to `invalid` or `expired`, surface the message, show "Send me a new link". Extend `create-client-magic-link` (or add a small companion function) to allow self-service resend: validate the invite token, confirm the requester email matches, regenerate a magic link with `email_redirect_to=/auth?invite={token}`, and dispatch the branded portal-invite email through `send-transactional-email`. Replace the direct `signInWithOtp` call with this helper.

## Technical Details

**Files**
- `supabase/functions/send-portal-invite-on-assignment/index.ts`
- `supabase/functions/create-client-magic-link/index.ts` (extend for resend)
- `supabase/functions/send-transactional-email/index.ts`
- `supabase/functions/notify-status-change/index.ts`
- `supabase/functions/process-email-queue/index.ts` (only if provider message_id / error logging is missing)
- New migration updating `accept_invitation(p_token)`
- `src/lib/sendClientInvite.ts`
- `src/components/staff/InviteClientDialog.tsx`
- `src/components/staff/SubmittedMarkets.tsx`
- `src/components/staff/CoverWhaleActions.tsx`
- `src/pages/Auth.tsx`

**Redeploy:** `send-portal-invite-on-assignment`, `create-client-magic-link`, `send-transactional-email`, `notify-status-change`, `process-email-queue` (if changed).

## End-to-End QA

1. Create test account, send manual invite, verify Gmail delivery + producer CC.
2. Click invite link → user is authenticated and lands on `/client` (no "Send Magic Link" step).
3. Verify `accounts.contact_email` is populated; existing values are preserved.
4. Mark a carrier "Submitted" → header flips to `quoting` without reload.
5. Mark a carrier "Additional Info Requested" → client receives email, producer CC'd, `activity_log` shows `email_sent` with queue_id, `email_send_log` shows pending → sent with provider message_id written by `process-email-queue`.
6. Test valid / expired / invalid / wrong-email invite tokens; resend works for each recoverable case.

## Out of Scope

- Rewriting the email queue architecture.
- Bulk-migrating older accounts missing `contact_email`.
- Changes to the staff invitation flow beyond shared helpers.
- Overwriting existing `accounts.contact_email` values.
