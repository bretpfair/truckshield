# Production Review Fixes

Address the read-only audit findings in priority order. Bundled into one pass since they're all small, surgical edits.

## 1. Admin login routing flash (`/client` flicker)

**Cause:** `AppLayout` checks `role` while `useAuth` is still resolving it. On first paint after sign-in, `role` is briefly `null` → `isStaffRole` is false → if the user lands on `/`, `RoleRedirect` sends them based on stale role, or guards mis-fire.

**Fix:**
- In `RoleRedirect.tsx`: already waits on `loading`, but also wait until `role !== undefined/null` before deciding (add a short "role pending" gate that returns the loader).
- In `AppLayout.tsx`: when `role` is still loading/null, render the loading state instead of running the `onDirectClientPortal` / `onStaffPortal` redirect guards. This prevents any client-shell paint for staff.
- In `Auth.tsx`: after successful sign-in, fetch the role once before calling `navigate('/staff' | '/client')` instead of relying on `/` + RoleRedirect.

## 2. Accounts tab routes to `/staff` instead of `/staff/accounts`

**Fix:** In `StaffDashboard.handleTabChange`, always navigate to `/staff/${value}` (including `accounts`). Keep `/staff` as a valid alias that still derives `currentTab = "accounts"`. Route `/staff/accounts` already exists in `App.tsx`.

## 3. Preview Client → wizard doesn't update URL

**Fix:** Add `/staff/preview/:accountId/application` route in `App.tsx` pointing at `ClientPortalForAccount`. In `ClientPortalForAccount`, mirror `ClientPortal`'s pattern: derive `showWizard` from `location.pathname.endsWith('/application')` and navigate to `…/application` / back when opening/closing the wizard.

## 4. Icon-only buttons missing accessible names

Add `aria-label` to every icon-only `<Button size="icon">` or icon-only ghost button. Sweep:
- `src/components/AppLayout.tsx` — sign-out button, Preview Client button when text is hidden on mobile (`hidden xs:inline`).
- `src/components/NotificationBell.tsx`, `ThemeToggle.tsx`.
- `src/components/staff/AccountDetail.tsx` — Back, Delete, Download, Send Invite, Preview Client (when icon-only).
- `src/components/staff/CarrierManager.tsx` — edit/delete row buttons.
- `src/components/staff/DocumentHub.tsx` — document action buttons.
- `src/components/staff/InviteStaffDialog.tsx` / `InviteClientDialog.tsx` — copy-link buttons.
- `src/components/messaging/MessagingSidebar.tsx` — collapse/expand toggle.

## 5. Invite Staff copy says "admin access" but defaults to Producer

**Fix:** In `InviteStaffDialog.tsx`, replace the static copy with role-aware text: "They'll receive {selectedRole} access upon signup." (or just "They'll receive the selected role upon signup.")

## 6. Dialog missing `aria-describedby`

**Fix:** The "New Account" UI in `StaffDashboard.tsx` uses a Card, not a Dialog — but the console warning indicates some Dialog elsewhere is missing it. Audit all `<DialogContent>` usages and add either a `<DialogDescription>` child or `aria-describedby={undefined}` per shadcn guidance. Likely culprits: InviteClientDialog, InviteStaffDialog, any confirm dialogs.

## 7. Metadata / robots / OG cleanup (`index.html`, `public/robots.txt`)

In `index.html`:
- Remove `<!-- TODO -->` comments and `<meta name="author" content="Lovable" />`.
- Replace `twitter:site="@Lovable"` with `@360RiskPartners` (or remove the tag).
- Replace broken signed-GCS `og:image` / `twitter:image` URLs with a stable asset (host one at `public/og-image.png` and reference `https://truckshield.360riskpartners.com/og-image.png`) — or remove the og:image tags entirely if no asset is ready.
- Add `<link rel="canonical" href="https://truckshield.360riskpartners.com/" />`, `<meta property="og:url" …>`, `<meta name="robots" content="noindex,nofollow" />` (this is a private B2B portal — should not be indexed at all).

In `public/robots.txt`:
- Switch to `User-agent: *` / `Disallow: /` since this is a gated portal, not a marketing site.

## 8. Security headers

The app is hosted on Lovable; we cannot set true HTTP response headers from the project. Add an `index.html` `<meta http-equiv="Content-Security-Policy" …>` covering script/style/img/connect sources (Supabase, fonts, self) and a `<meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=()">`. Document in `.lovable/plan.md` that `X-Frame-Options` / `frame-ancestors` and HSTS need to be set at the hosting/CDN layer — they cannot be set via meta tags reliably and should be configured at the custom domain proxy if available.

## Files changed

- `src/App.tsx` — add preview wizard route
- `src/components/AppLayout.tsx` — role-loading gate, header aria-labels
- `src/components/RoleRedirect.tsx` — wait on role resolution
- `src/pages/Auth.tsx` — role-aware post-login redirect
- `src/pages/StaffDashboard.tsx` — Accounts tab navigates to `/staff/accounts`
- `src/pages/ClientPortalForAccount.tsx` — wizard URL sync
- `src/components/staff/InviteStaffDialog.tsx` — fix copy
- `src/components/staff/AccountDetail.tsx`, `CarrierManager.tsx`, `DocumentHub.tsx`, `InviteClientDialog.tsx`, `NotificationBell.tsx`, `ThemeToggle.tsx`, `messaging/MessagingSidebar.tsx` — aria-labels
- Dialog audit: add `<DialogDescription>` where missing
- `index.html` — metadata cleanup, CSP/Permissions-Policy, canonical, robots noindex
- `public/robots.txt` — disallow all

## Out of scope

- True HTTP security headers (HSTS, X-Frame-Options, real CSP) — requires hosting-layer config, not code.
- Full state-changing QA pass (account creation, invites, uploads, quote flow) — user said they'll do this separately with a test account.
- New OG image generation — only swap the broken URL; ask before generating new artwork.
