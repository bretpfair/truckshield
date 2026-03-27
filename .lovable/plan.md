

## Plan: Delete Account, Close/Lost Status, and Additional Info Request Flow

### Overview
Four changes: (1) delete account capability, (2) closed/lost status to remove from pipeline, (3) popup when carrier status changes to "Additional Info Requested" requiring staff to enter what's needed, (4) that info surfaces as a notification/popup for the client on next login plus an email notification.

### Technical Details

#### 1. Database Migration
- Add `closed_lost` to the account status vocabulary (no enum change needed — `status` is a text column)
- Create an `info_requests` table to store the additional info request details:
  ```sql
  CREATE TABLE public.info_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    quote_id uuid NOT NULL,
    carrier_name text NOT NULL,
    request_details text NOT NULL,
    status text NOT NULL DEFAULT 'pending', -- pending, resolved
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
  );
  ALTER TABLE public.info_requests ENABLE ROW LEVEL SECURITY;
  -- Admin full access
  CREATE POLICY "Admins can manage info_requests" ON public.info_requests FOR ALL USING (has_role(auth.uid(), 'admin'));
  -- Clients can view/update their own
  CREATE POLICY "Clients can view own info_requests" ON public.info_requests FOR SELECT USING (account_id IN (SELECT id FROM accounts WHERE client_user_id = auth.uid()));
  CREATE POLICY "Clients can update own info_requests" ON public.info_requests FOR UPDATE USING (account_id IN (SELECT id FROM accounts WHERE client_user_id = auth.uid()));
  ```

#### 2. AccountDetail.tsx — Delete Account + Close/Lost Button
- Add a **Delete Account** button (with AlertDialog confirmation) that deletes the account and related records, then navigates back to the dashboard
- Add a **Close / Lost** button in the header that sets `status = 'closed_lost'` and navigates back
- Both use confirmation dialogs to prevent accidental actions

#### 3. PipelineView.tsx — Exclude Closed/Lost
- Filter out `closed_lost` accounts from pipeline columns (they won't appear since there's no `closed_lost` column)
- Optionally show a "Closed/Lost" count badge somewhere for awareness

#### 4. SubmittedMarkets.tsx — Info Request Popup
- When staff changes a carrier status to `info_requested`, intercept the status change
- Show a Dialog requiring staff to enter the missing info details before the status change is saved
- On save: update quote status, insert into `info_requests`, create a client notification, send a transactional email to the client

#### 5. Transactional Email — Additional Info Request
- Create a new email template `additional-info-request.tsx` in `_shared/transactional-email-templates/`
- Register it in `registry.ts`
- Email content: notify client that a carrier needs more info, include carrier name and portal link
- Deploy updated edge functions

#### 6. ClientPortalForAccount.tsx — Info Request Popup on Login
- Query `info_requests` where `status = 'pending'` for the account
- On mount, if pending requests exist, show a Dialog listing each carrier's request with the details
- Client can acknowledge/dismiss (mark as read) — the popup shows each time until resolved
- The existing "Action Needed" section already shows `info_requested` quotes; enhance it to show the actual request details from `info_requests`

### Files to Create/Modify
1. **New migration** — `info_requests` table with RLS
2. **New template** — `supabase/functions/_shared/transactional-email-templates/additional-info-request.tsx`
3. **Edit** — `supabase/functions/_shared/transactional-email-templates/registry.ts` (add template)
4. **Edit** — `src/components/staff/AccountDetail.tsx` (delete + close/lost buttons)
5. **Edit** — `src/components/staff/SubmittedMarkets.tsx` (info request dialog on status change)
6. **Edit** — `src/pages/ClientPortalForAccount.tsx` (pending info request popup)
7. **Edit** — `src/components/staff/PipelineView.tsx` (exclude closed_lost or keep as-is since no column matches)
8. **Deploy** — edge functions after template changes

