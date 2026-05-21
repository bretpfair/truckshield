# Staff UI: Invite & Email Workflow Visibility

UI-only refresh of staff Account Detail and Account List so invite/email state is obvious and actionable. One small frontend helper (`getInviteSnapshot.ts`) to avoid per-row N+1 fetches. No backend changes. Retry / Send New Link reuses the existing working `sendClientInvite` flow.

## Build order (priority)

1. Next Step banner
2. Invite Status Card
3. Email Delivery badges + collapsible details
4. Account list quick filters
5. Activity grouping (visual only)

## 1. Next Step Banner (account detail)

New `src/components/staff/AccountNextStep.tsx`, mounted under the header row in `AccountDetail.tsx`. Single dense `glass-panel` row with status-colored left border, plain copy, one or two inline action buttons.

Inference order (first match wins; if a status can't be confidently derived, banner is hidden — never invent statuses):

1. `accounts.contact_email` missing → "Client email missing" · "Add Email" (opens existing `InviteClientDialog`).
2. Latest `email_send_log` row for `client-portal-invite` is `failed` / `dlq` / `bounced` AND newer than the latest `client_invitations` row → "Invite email delivery failed" · "Retry" (calls existing `sendClientInvite`).
3. Latest invitation `pending` (and not expired), no `client_user_id` → "Client invited, waiting for portal access" · "Send New Link" (calls existing `sendClientInvite` — same path Resend uses today).
4. `client_user_id` set OR invitation status `accepted` → "Client portal access active" (no action).
5. Application incomplete (`getAccountDataCompleteness`) → "Application incomplete — {missing[0]}" · "View Application" (+ "Request Info" if an existing handler is found; otherwise just View).
6. Ready (`ready === true`, status in `pending_info` / `info_complete`) → "Ready to check markets" · "Check Markets" (scrolls Market Guidance into view).

All data sourced from the existing `account` query + one new `useQuery(['invite-snapshot', accountId])` from `getInviteSnapshot.ts`.

## 2. Invite Status Card

New `src/components/staff/InviteStatusCard.tsx`. Replaces the current bare `<InviteClientDialog>` mount at the bottom of `AccountDetail.tsx`. The dialog component is still reused as the "Edit email & send" form behind a button.

Card content (dense, `grid-cols-1 sm:grid-cols-2`):

- Client email (with pencil → opens `InviteClientDialog`)
- Last invite sent: timestamp or "—"
- Email delivery: `<EmailStatusBadge />` — Queued / Pending / Sent / Failed / Bounced / Unknown
- Invite status: `<InviteStatusBadge />` — Pending / Accepted / Expired / Active / Unknown
- Last accepted: timestamp or "—"
- Buttons: "Send Invite" / "Send New Link" (one or the other, both call `sendClientInvite`); "View Email Log" scrolls to `EmailDeliveryLog`; "Copy Link" only shown when `safeInviteUrl` exists — strictly the stable `/auth?invite={token}` URL, never a Supabase magic-link/hashed URL.

## 3. Email Delivery badges + details

New `src/components/staff/EmailStatusBadge.tsx` exporting `<EmailStatusBadge status="..." />` and `<InviteStatusBadge status="..." />`. Centralizes the existing palette (`bg-warning/10 text-warning`, etc.) and covers `queued` and `accepted` / `expired` for invite use. Labels: Queued, Pending, Sent, Failed, Bounced, Suppressed, Rate-Limited, DLQ, Accepted, Expired, Active, Unknown.

Update `EmailDeliveryLog.tsx` and `StaffEmailLog.tsx`:

- Swap inline `<Badge variant="outline" className={...}>` for `<EmailStatusBadge />`.
- For `failed` / `bounced` / `dlq` rows, render a plain-language first-sentence summary (truncated ~120 chars) next to the badge.
- Move full `error_message`, `provider_message_id`, `message_id`, and raw metadata access into a `<Collapsible>` "Details" disclosure inside the same row (one extra `<tr>` underneath when expanded).

## 4. Staff Account List quick filters

In `PipelineView.tsx`, add a chip row above the existing search/filter controls. Single-select toggle, re-click to clear.

Chips & data source:

- Missing Email — `!account.contact_email` (loaded already)
- Needs Info — `account.status === 'pending_info'` (loaded already)
- Ready for Markets — `account.application_step === 10` AND `status === 'pending_info'/'info_complete'` (loaded already; intentionally permissive without per-account completeness fetch)
- Stale 7+ Days — existing `isStale` helper (already computed)
- Invite Pending / Invite Accepted / Email Failed — backed by two new lightweight bulk queries:
  - `client_invitations` → `select('account_id, status, expires_at, created_at')` once for all accounts, reduce to a `Map<account_id, latestInvite>`.
  - `email_send_log` → `select('id, created_at, status, metadata')` `eq('template_name', 'client-portal-invite')`, reduce to a `Map<account_id, latestInviteEmail>` (account_id read from `metadata->>account_id`).
  
  Both queries are independent of account count (single round-trip each), so no N+1. RLS already restricts both tables to accessible accounts. If either query is disabled by RLS for the current viewer (e.g. producer with limited access), the three derived chips are disabled with a tooltip instead of inventing data.

## 5. Activity grouping (visual only)

In `ActivityLog.tsx`, group consecutive entries that share `metadata.message_id` (fallback: same template/recipient within a 10-minute window) covering `client_invite_sent`, `client_invite_resent`, `email_queued`, `email_sent`, `email_failed`, `client_linked`. Render as one collapsible row: "Portal invite — {recipient} · {final status}" with the latest timestamp. Expanding reveals the raw rows verbatim with their existing icons/badges. All other entries unchanged. No DB writes — purely client-side reduce.

## Files

- New: `src/lib/getInviteSnapshot.ts`
- New: `src/components/staff/EmailStatusBadge.tsx`
- New: `src/components/staff/AccountNextStep.tsx`
- New: `src/components/staff/InviteStatusCard.tsx`
- Edit: `src/components/staff/AccountDetail.tsx` (mount banner + card; replace bottom InviteClientDialog block)
- Edit: `src/components/staff/EmailDeliveryLog.tsx` (badge + Details disclosure)
- Edit: `src/pages/StaffEmailLog.tsx` (badge + Details disclosure)
- Edit: `src/components/staff/PipelineView.tsx` (chip row + bulk invitation/email maps)
- Edit: `src/components/staff/ActivityLog.tsx` (invite-event grouping)

## Constraints honored

- UI only, no edge function / DB changes.
- No Supabase auth/magic-link URLs exposed or copied. Only the stable `/auth?invite={token}` URL is copyable, and only when a pending invitation exists.
- Statuses derived strictly from existing `client_user_id`, `client_invitations`, and `email_send_log`. If ambiguous → "Unknown" badge or banner hidden.
- Account-list extras use two bulk queries, not per-row lookups.
- Retry / Send New Link reuse `sendClientInvite()` from `src/lib/sendClientInvite.ts`.
- Activity grouping is visual; raw rows remain visible on expand.

## Manual QA

1. Account without `contact_email` → banner "Client email missing"; status card empty + "Add Email" opens dialog. Chip "Missing Email" matches in list.
2. Account with email, no invite → banner says next-most-relevant ("Application incomplete" or "Ready"); status card shows Invite Status: Unknown + "Send Invite".
3. Send invite → banner flips to "Client invited, waiting for portal access"; status card shows Email Delivery: Pending → Sent; Invite Status: Pending; "Copy Link" appears (`/auth?invite=...`). "Invite Pending" chip matches in list.
4. Force a failed send → banner shows "Invite email delivery failed" + Retry; email log row shows Failed badge + short summary + Details disclosure with full `error_message` / `provider_message_id`. "Email Failed" chip matches in list.
5. Accept invite in incognito → banner "Client portal access active"; status card shows Invite Status: Active. "Invite Accepted" chip matches in list.
6. Quick filter chips toggle and clear cleanly; combining with search still works.
7. Activity feed → invite + email_queued + email_sent collapse to one row; expand shows the originals.
8. Mobile 360px → banner/card/chips/email rows do not overlap or truncate important text.