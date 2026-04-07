

## Problem Analysis

The current client sign-in flow has significant friction:

1. **Double email check** — Client receives an invite email, clicks the link, lands on `/auth?invite=TOKEN`, then must type their email and wait for a *second* magic link email. That's two separate emails just to get in.
2. **Token confusion** — If the magic link redirect loses the `?invite=TOKEN` param (e.g. email client mangles the URL), the invitation is never accepted and the client sees an empty portal.
3. **No clear error handling** — If the invite token is expired or already used, the client just sees a generic sign-in page with no actionable guidance.
4. **No "resend" option from the client side** — If the magic link email doesn't arrive, the client has no way to request a new one without re-entering their email.

## Proposed Solution: Single-Click Magic Link Invite

Eliminate the two-step process by embedding the magic link directly into the invite email. When a client clicks the invite link, they are authenticated immediately — no second email needed.

### How it works

1. **Staff invites client** → system calls a new Edge Function `create-client-magic-link` that:
   - Creates/updates the `client_invitations` record as before
   - Generates a Supabase magic link (using the Admin API's `generateLink`) for the client's email
   - Combines the magic link with the invite token so both auth and invitation acceptance happen in one click
   - Sends the invite email with this combined link

2. **Client clicks the single link** → Supabase verifies the OTP, creates a session, and redirects to `/auth?invite=TOKEN`. Since the session already exists on mount, the existing `useEffect` accepts the invitation and redirects to the portal instantly.

3. **Fallback for expired links** — If the magic link has expired (default 1 hour), the `/auth` page detects the invite token, pre-fills the client's email (fetched from the invitation record), and offers a one-click "Send me a new link" button instead of a blank email form.

### Changes

**New Edge Function: `create-client-magic-link`**
- Uses `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })` to create a server-side magic link
- Returns the combined URL to the caller
- The invite email template uses this URL as the CTA button link

**Update `sendClientInvite.ts`**
- Instead of building a plain `/auth?invite=TOKEN` link, call the new Edge Function to get an authenticated magic link
- Pass the resulting URL to the email template

**Update `Auth.tsx`**
- When `?invite=TOKEN` is present but no session exists:
  - Fetch the invitation's email from the DB (new lightweight RPC or direct query)
  - Pre-fill the email field so the client doesn't have to type it
  - Show a clear message: "Click below to access your portal"
  - Auto-submit the magic link request on load (or with a single button click)
- Add clear error states for expired/invalid invite tokens
- Add a "Resend link" button that's always visible after the magic link is sent

**Update invite email template**
- The CTA button URL changes from a plain portal link to the pre-authenticated magic link

### Technical Details

```text
CURRENT FLOW (2 emails, 4+ steps):
  Invite email → Click link → Type email → Wait for magic link email → Click magic link → Portal

NEW FLOW (1 email, 1 step):
  Invite email → Click link → Portal
  
FALLBACK (if link expired, 1 extra step):
  Invite email → Click expired link → See pre-filled email + "Resend" → Click magic link → Portal
```

The Edge Function needs `service_role` access for `admin.generateLink()`. The `SUPABASE_SERVICE_ROLE_KEY` secret is already configured.

### Files to create/modify

- **Create** `supabase/functions/create-client-magic-link/index.ts` — new Edge Function
- **Modify** `src/lib/sendClientInvite.ts` — call the new Edge Function
- **Modify** `src/pages/Auth.tsx` — pre-fill email from invite, better error states, auto-request flow
- **Modify** invite email template — use the authenticated URL

