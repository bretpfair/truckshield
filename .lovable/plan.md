## Problem

When a client works through the application wizard quickly, the wizard fires `application-milestone` emails inline on every autosave that crosses 25%, 50%, or 75%. That's why the screenshot shows three "Keep Going" emails to Ella within ~15 minutes (11:44 / 11:46 / 12:02). There's also no inactivity cutoff — `application-not-started` and `application-reminder` keep going out indefinitely from the daily cron.

The desired behavior:

1. At most **one** progress/milestone email per client per day.
2. Stop sending progress/milestone/reminder emails once the account has been **inactive for 14+ days**.

## Plan (UI + small edge-function change, no schema migration)

### 1. Remove inline milestone sends from the wizard
File: `src/components/application/ApplicationWizard.tsx`

- Delete the entire "Milestone celebration emails (25%, 50%, 75%)" block inside `updateAccount.onSuccess` (lines ~214–250) and the `lastMilestoneSent` ref.
- Reason: firing on autosave is what causes 3 emails in 15 minutes. Milestones will instead be evaluated once per day by the existing reminder cron.

### 2. Move milestone logic into the daily reminder job
File: `supabase/functions/send-reminder-emails/index.ts`

In the "Incomplete application reminders" loop (around lines 285–320), for each `pending_info` account with `client_user_id`:

- Compute current completion % via the existing `calculateServerProgress(...)`.
- Determine the **highest crossed milestone** in `[25, 50, 75]` (`Math.floor(progress / 25) * 25`, capped at 75; skip if 0).
- Idempotency key: `app-milestone-<accountId>-<milestone>`. The existing `enqueueEmail` helper already blocks duplicates by `(template_name, recipient_email)` within `REMINDER_INTERVAL_DAYS` — keep that, and additionally short-circuit if a row with that exact `idempotencyKey` already exists in `email_send_log` (so a given milestone is only ever sent once per account).
- Only enqueue **one** email per account per cron run, prioritizing in this order:
  1. `application-not-started` (step ≤ 1)
  2. `application-milestone` (new milestone crossed and not previously sent)
  3. `application-reminder` (general progress nudge)
- This guarantees "1 email per day per client" for the whole progress/milestone/not-started family.

### 3. Add 14-day inactivity cutoff
Same file, top of the incomplete-accounts query (around lines 253–258):

- Add `.gte('updated_at', fourteenDaysAgo)` where `fourteenDaysAgo = new Date(Date.now() - 14*24*60*60*1000).toISOString()`.
- Apply the same cutoff to the `first-login-followup` and info-request reminder loops so no reminder email is sent to an account that hasn't been touched in 14 days.
- `accounts.updated_at` already exists and is bumped on every wizard autosave, so this is a pure filter — no migration needed.

### 4. Documentation
- Update `mem://features/application-wizard` and `mem://logic/insurance-application/submission-logic` notes to record: "Milestone/reminder emails are scheduled by the daily cron only — never sent inline from autosave. Max 1 progress email per account per day. Stops after 14 days of `accounts.updated_at` inactivity."

## Out of scope

- No DB migration. No new columns.
- No changes to non-progress emails (carrier status, application-received, info-request, invite, post-bind, etc.) — those are event-driven and already idempotent.
- No template copy changes.

## Manual QA after build

1. Open an account, advance the wizard from 0% → 80% in one sitting. Verify **no** milestone email arrives during the session.
2. Run `send-reminder-emails` (or wait for cron). Verify exactly one email lands: `application-milestone` for 75%.
3. Re-run the cron the same day. Verify no second milestone/reminder email is queued for that account.
4. Set an account's `updated_at` to 15 days ago. Run the cron. Verify no reminder/milestone email is sent.
5. Check `email_send_log` and the `/staff/emails` view — grouped rows should no longer show same-minute milestone duplicates.
