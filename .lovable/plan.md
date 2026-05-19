# Add real URL routes so Back works inside the portal

## Problem

The whole app currently mounts at `/` and switches views with `useState` (staff dashboard, account detail, tabs, wizard, "Preview as Client"). The URL never changes, so the browser Back button leaves the site instead of navigating within it. Pages also can't be bookmarked, shared, or refreshed without losing context.

## Goal

Drive every meaningful navigation from the URL using React Router (already installed), without rewriting the page components themselves. Each currently-stateful "view" becomes a route that renders inside the existing `AppLayout` shell.

## New URL structure

```text
/                                  → role-based redirect (staff → /staff, client → /client)
/auth, /reset-password, /unsubscribe (unchanged)

/staff                             → Staff dashboard, "Accounts" tab
/staff/pdf-import
/staff/carriers          (admin)
/staff/analytics         (admin)
/staff/invite
/staff/invite-staff      (admin)
/staff/team              (admin)
/staff/accounts/:accountId             → AccountDetail
/staff/accounts/:accountId/application → AccountDetail + wizard open
/staff/preview/:accountId              → ClientPortalForAccount (staff "Preview as Client")

/client                            → Client portal home
/client/application                → Client portal with wizard open
```

Tab switches, account selection, "View Account" actions, "Preview Client", "Back", and opening the application wizard all become real navigations. Notification clicks and existing in-app links route via `navigate(...)` instead of `setState`.

## Implementation

### 1. Routes (`src/App.tsx`)

Replace the single `/` route with nested routes that all render `<AppLayout>` as a layout component (via `<Outlet />`). Public routes (`/auth`, `/reset-password`, `/unsubscribe`) stay outside the layout.

```text
<Routes>
  <Route path="/auth" .../>
  <Route path="/reset-password" .../>
  <Route path="/unsubscribe" .../>
  <Route path="/preview-client" .../>          (existing mock route)
  <Route path="/preview-staff" .../>           (existing mock route)

  <Route element={<AppLayout />}>              (auth guard + header + messaging shell)
    <Route path="/" element={<RoleRedirect />} />
    <Route path="/staff" element={<StaffDashboard />} />
    <Route path="/staff/:tab" element={<StaffDashboard />} />
    <Route path="/staff/accounts/:accountId" element={<AccountDetail />} />
    <Route path="/staff/accounts/:accountId/application" element={<AccountDetail />} />
    <Route path="/staff/preview/:accountId" element={<ClientPortalForAccount />} />
    <Route path="/client" element={<ClientPortal />} />
    <Route path="/client/application" element={<ClientPortal />} />
  </Route>

  <Route path="*" element={<NotFound />} />
</Routes>
```

### 2. `AppLayout.tsx` becomes a pure shell

- Remove `viewAsClient`, `previewAccountId`, `staffNavigateAccountId` state and the conditional rendering of `StaffDashboard` / `ClientPortal` / `ClientPortalForAccount`.
- Keep: auth gating, header (logo, role badge, NotificationBell, ThemeToggle, sign-out), realtime hook, MessagingSidebar.
- Render `<Outlet />` where the main view used to be.
- Header "Preview Client" / "Back to Staff" toggle becomes `navigate('/staff/preview/<accountId?>')` or `navigate('/staff')`. Without an account it goes to `/client` for "preview generic" (matches today's behavior).
- Role-badge label ("Staff" vs "Client") derives from `location.pathname.startsWith('/staff')`.
- Messaging sidebar account id derives from `useParams().accountId` (when on an account route) instead of internal state.
- NotificationBell `onNavigateToAccount` calls `navigate(`/staff/accounts/${id}`)`.

### 3. `StaffDashboard.tsx`

- Drive the Tabs `value` from `useParams().tab` (default `"accounts"`); `onValueChange` calls `navigate(`/staff/${value === 'accounts' ? '' : value}`)`.
- Remove `selectedAccountId` state and the inline `<AccountDetail>` render block. "Select account" handlers call `navigate(`/staff/accounts/${id}`)`.
- Remove the `navigateToAccountId` / `onNavigateHandled` / `onPreviewClient` / `onOpenMessages` props — replaced by URL + `useParams`.
- `PipelineView` and list cards: `onSelectAccount` → `navigate(...)`.

### 4. `AccountDetail.tsx`

- Read `accountId` from `useParams()` instead of props.
- `onBack` → `navigate(-1)` (falls back to `/staff` if no history).
- Open/close wizard navigates to `/staff/accounts/:id/application` and back to `/staff/accounts/:id`; `showWizard` derives from the route.
- "Preview as Client" button → `navigate(`/staff/preview/${accountId}`)`.

### 5. `ClientPortal.tsx`

- Open/close wizard navigates `/client/application` ↔ `/client`; `showWizard` derives from route.
- Remove `onSetMessagingAccount` prop — sidebar reads account from a context value set by this component via `useEffect`, or simply uses the route (client has exactly one account, derived from query).

### 6. `ClientPortalForAccount.tsx`

- Read `accountId` from `useParams()`.
- Existing "Back" button → `navigate('/staff')`.

### 7. `Auth.tsx` post-login redirect

After successful sign-in, redirect by role: admin/producer → `/staff`, client → `/client`. The new `RoleRedirect` component at `/` does the same so a manually-typed `/` always lands somewhere sensible.

### 8. Preserved behaviors

- All existing data fetching, mutations, RLS, messaging, realtime, notifications, and styling are untouched.
- Preview mock routes (`/preview-client`, `/preview-staff`) stay as-is.
- No database changes.

## Files changed

- `src/App.tsx` — new route tree
- `src/components/AppLayout.tsx` — strip state, render `<Outlet />`, header uses `navigate`
- `src/pages/StaffDashboard.tsx` — tabs + account selection via router
- `src/components/staff/AccountDetail.tsx` — params + navigate for back/wizard/preview
- `src/pages/ClientPortal.tsx` — wizard route, drop sidebar prop
- `src/pages/ClientPortalForAccount.tsx` — params + navigate
- `src/pages/Auth.tsx` — role-based post-login redirect
- New: `src/components/RoleRedirect.tsx` — small helper for `/`

## Out of scope

- Splitting Staff tabs (`carriers`, `analytics`, etc.) into separate top-level pages — they remain tabs under `/staff/:tab`, which already gives them their own URL.
- Deep-linking individual AccountDetail sub-tabs (Application / Documents / Markets / Messages). Can be a follow-up with `?section=` if wanted.
