# Move Welcome Email to Producer Assignment

## Goal

Today the `client-portal-invite` welcome email fires when CTQ pushes a new lead, *before* a producer is assigned. So the assigned producer is never CC'd on the intro. Move the trigger so the email fires the moment an account first gets a producer assigned — that way the producer is in CC and on Reply-To from the very first touchpoint.

## Behavior changes

**Before:** CTQ webhook → account created → invite + welcome email sent immediately (no producer = no CC).

**After:** CTQ webhook → account created (no email). Later, when an admin assigns a producer (or a producer self-claims) → invite + welcome email sent with producer CC'd and as Reply-To.

If an account is reassigned later, the email does **not** re-fire — only the *first* assignment triggers it. This prevents duplicate welcomes.

If a staff member uses the existing manual "Invite Client" dialog before any producer is assigned, that still works as today (sends without CC). Manual invites always honor the user's explicit action.

## Where it triggers

The email will fire from any code path that sets `assigned_producer_id` from `null` to a real user id:

1. `PipelineView.tsx` — admin assigns producer via dropdown (line ~323)
2. `AccountDetail.tsx` — `ProducerAssignment` dropdown change (line ~69)
3. `AccountDetail.tsx` — producer self-claim path (line ~357)

To keep this DRY and bulletproof (and to also cover any future code paths or direct DB updates), the trigger logic will live in a **database trigger** on `accounts`, not in the UI. The trigger fires only when:
- `OLD.assigned_producer_id IS NULL`
- `NEW.assigned_producer_id IS NOT NULL`
- The account has a `contact_email`
- No `client_user_id` is already linked (client hasn't already accepted)
- No prior `client_invitations` row for this account (avoid duplicate if CTQ-era invite already exists for legacy accounts mid-migration)

The trigger calls a new edge function `send-portal-invite-on-assignment` via `pg_net.http_post`, which:
1. Creates the `client_invitations` row (token, email)
2. Resolves the assigned producer's email (with suppression/unsubscribe checks — same helper pattern already used in `notify-status-change`)
3. Calls `send-transactional-email` with `templateName: 'client-portal-invite'`, `cc` and `reply_to` set to the producer
4. Logs to `activity_log`

## CTQ webhook change

Remove the auto-invite block in `ctq-webhook/index.ts` (lines 515-563). New CTQ leads will sit in the pipeline with no email sent until assigned. Update the response to drop the `auto_invited` flag (or always return false).

## Edge cases handled

- **Reassignment**: trigger checks `OLD.assigned_producer_id IS NULL` so only the first assignment fires.
- **Manual invite already sent**: trigger checks for existing `client_invitations` row — won't duplicate.
- **Client already linked**: `client_user_id IS NOT NULL` skip.
- **No contact email**: skip silently with activity log entry.
- **Producer suppressed/unsubscribed**: send without CC (don't block the client email).
- **Legacy accounts** already in DB without producer: when an admin finally assigns one, they'll get the welcome — desirable behavior, the client never got it before.

## Technical Details

### New migration

```sql
create or replace function public.send_invite_on_producer_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url text; v_key text;
begin
  if old.assigned_producer_id is not null
     or new.assigned_producer_id is null
     or new.contact_email is null
     or new.client_user_id is not null then
    return new;
  end if;

  -- Skip if an invitation already exists
  if exists (select 1 from client_invitations where account_id = new.id) then
    return new;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;

  if v_url is not null and v_key is not null then
    perform net.http_post(
      url := v_url || '/functions/v1/send-portal-invite-on-assignment',
      body := jsonb_build_object('account_id', new.id::text),
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)
    );
  end if;
  return new;
end $$;

create trigger trg_send_invite_on_producer_assignment
after update of assigned_producer_id on accounts
for each row execute function send_invite_on_producer_assignment();
```

### New edge function: `send-portal-invite-on-assignment`

- Auth: requires service-role bearer token.
- Loads account (`contact_email`, `business_owner_name`, `assigned_producer_id`, `company_name`, `client_user_id`).
- Re-checks all guard conditions (defense in depth).
- Inserts `client_invitations` row.
- Resolves producer email via the same helper pattern as `notify-status-change` (suppression + unsubscribe checks).
- Invokes `send-transactional-email` with `cc: producerEmail`, `replyTo: producerEmail`, `templateData: { firstName, portalLink }`.
- Logs `activity_log` entry: `client_linked` action, "Auto-invitation sent to {email} (triggered by producer assignment to {producerName})".

### `send-transactional-email` already supports `cc` / `replyTo`

Confirmed from the prior CC/Reply-To rollout — no changes needed there.

### CTQ webhook edit

Delete lines 515-563 of `supabase/functions/ctq-webhook/index.ts` (the auto-invite block). Drop the `auto_invited` field from the response.

### Files changed

- **New**: `supabase/migrations/<timestamp>_invite_on_producer_assignment.sql`
- **New**: `supabase/functions/send-portal-invite-on-assignment/index.ts`
- **Edit**: `supabase/functions/ctq-webhook/index.ts` (remove auto-invite block)
- **Deploy**: `ctq-webhook`, `send-portal-invite-on-assignment`

### Memory updates

- Update `mem://logic/communication-logic/producer-cc-notifications` to note that the welcome invite is now triggered on first producer assignment (with CC) instead of CTQ ingestion.
- Update `mem://features/client-onboarding` to reflect the new trigger point.

## Out of scope

- No change to manual invite flows (`InviteClientDialog`, `sendClientInvite` calls from `ApplicationWizard`, `StaffDashboard`, `AccountDetail`). Those remain manual, on-demand, and behave as today.
- No change to `application-received`, status-change, or reminder emails — they already use the producer CC pattern.
- No backfill for legacy unassigned accounts — they'll get the welcome naturally when someone is finally assigned.
