

# Add Producer & Admin Staff Roles with Account Assignment

## Summary
Introduce a "producer" staff role alongside the existing "admin" role. Each account gets assigned to a producer. Producers only see their own accounts; admins see everything.

## Database Changes

### 1. Extend the `app_role` enum
Add `'producer'` to the existing `app_role` enum type.

### 2. Add `assigned_producer_id` column to `accounts`
- New nullable `uuid` column on `accounts` referencing `auth.users(id)` — no, per project rules, no FK to `auth.users`. Just a plain `uuid` column.
- When staff creates an account, it defaults to the creating user's ID.

### 3. Update RLS policies on `accounts`
- Keep the existing admin-can-manage-all policy (admins see everything).
- Add a new policy: **Producers can view/manage assigned accounts** — `USING (assigned_producer_id = auth.uid() AND has_role(auth.uid(), 'producer'))` for ALL commands.

### 4. Update RLS on related tables
Tables like `quotes`, `activity_log`, `tasks`, `messages`, `drivers`, `power_units`, `trailers`, `loss_history`, `account_documents`, `info_requests`, `garage_locations`, `market_guidance_results` all have admin-only policies. Add producer policies that check `account_id IN (SELECT id FROM accounts WHERE assigned_producer_id = auth.uid())` so producers can work their accounts.

### 5. Add `has_role` check for producer
The existing `has_role()` function already works for any `app_role` value — no change needed once the enum is extended.

## Frontend Changes

### 6. Update `useAuth` role type
Change `AppRole` from `"admin" | "client" | null` to `"admin" | "producer" | "client" | null`.

### 7. Update `AppLayout` access logic
- Both `admin` and `producer` roles should see the staff dashboard (not the client portal).
- The "Preview Client" button stays available for both.
- Admin-only features (like Invite Staff, Carrier Manager) should be hidden from producers.

### 8. Update `StaffDashboard`
- The accounts query already goes through RLS, so producers will automatically only see their assigned accounts — no query changes needed.
- Hide admin-only tabs/features (Carrier Manager, Invite Staff, Analytics) from producers.
- Add a "Producer Assignment" dropdown on account detail (admin-only) to reassign accounts.

### 9. Update account creation
- When creating a new account, auto-set `assigned_producer_id` to the current user's ID.
- Admins can reassign via a dropdown showing all producers/admins.

### 10. Update `InviteStaffDialog`
- Add a role selector (Admin vs Producer) when inviting new staff.
- Update the `accept_staff_invitation` function or create a new one that assigns the chosen role.

## Technical Details

- The `app_role` enum extension requires: `ALTER TYPE public.app_role ADD VALUE 'producer';`
- RLS for producers uses the same `has_role()` security-definer function.
- No changes to edge functions — they use service_role keys and bypass RLS.
- The `create_notification_on_event` trigger finds admins via `user_roles WHERE role = 'admin'`; we should also notify the assigned producer.

