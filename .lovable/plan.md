

## Plan: Pipeline Progress, Server-Side Completion Calculation, and Application-Not-Started Reminder

### Summary

Three changes:
1. **PipelineView** — Replace the inaccurate `application_step`-based progress bar with real section-based completion (reusing the same logic from `useApplicationProgress`).
2. **send-reminder-emails Edge Function** — Calculate real completion percentage server-side using section-based checks instead of `application_step`, and use that in the `application-reminder` email.
3. **New "application not started" reminder** — Add a new email template and trigger for clients who logged in but still have `application_step = 1`.

---

### Technical Details

#### 1. PipelineView — Accurate Progress Bar

Currently (line 464-465): `const pct = Math.round((step / 10) * 100)` — wrong.

**Approach**: For each `pending_info` account, fetch the same related data (power_units, trailers, drivers, loss_history) and run the same 9-section checks. Since PipelineView already has all accounts loaded, we need batch queries.

- Add queries for `power_units`, `trailers`, `drivers`, `loss_history` scoped to pending_info account IDs.
- Create a helper function `calculateProgress(account, powerUnits, trailers, drivers, lossHistory)` that mirrors the `useApplicationProgress` logic.
- Replace the inline `pct` calculation with the real value.
- The accounts query in StaffDashboard already fetches full account data (`select("*")`), so all fields like `coverage_selections`, `general_questions`, `radius_operations`, `commodity_info` are available.

**File**: `src/components/staff/PipelineView.tsx`
- Add `useQuery` calls for power_units, trailers, drivers, loss_history for pending_info accounts
- Extract a pure `calculateAccountProgress` function (shared or inline)
- Replace lines 463-474

#### 2. send-reminder-emails — Server-Side Real Completion %

Currently (line 176-178): uses `application_step` to calculate %. 

**Approach**: After fetching `incompleteAccounts`, also fetch their related data (power_units, trailers, drivers, loss_history) in batch, then run the same 9-section completion logic server-side.

- Expand the accounts query to `select('*')` to get `coverage_selections`, `general_questions`, `radius_operations`, `commodity_info`.
- Batch-fetch power_units, trailers, drivers, loss_history for all incomplete account IDs.
- Port the section-complete checks into a server-side helper function.
- Pass real `completionPercent` to the email template.

**File**: `supabase/functions/send-reminder-emails/index.ts`

#### 3. New "Application Not Started" Reminder Email

For clients who accepted the invite (have `client_user_id`) but `application_step` is still 1 and status is `pending_info`.

- Create `supabase/functions/_shared/transactional-email-templates/application-not-started.tsx` — a simpler, more urgent template encouraging the client to begin.
- Register in `registry.ts`.
- Add a section in `send-reminder-emails/index.ts` that filters for `application_step = 1` accounts and sends the `application-not-started` template instead of `application-reminder`.
- The existing `application-reminder` will continue to handle accounts with `application_step > 1` but `< 10`.

**Files**:
- `supabase/functions/_shared/transactional-email-templates/application-not-started.tsx` (new)
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (add import)
- `supabase/functions/send-reminder-emails/index.ts` (split logic)

#### 4. Deploy

Redeploy `send-reminder-emails` and `send-transactional-email` edge functions after all changes.

