## Goal
Make the first client invite link work reliably so clients can click the TruckShield email link, authenticate, and land in their portal without seeing “Invalid or expired invitation.”

## Root cause found
The invite page currently checks `client_invitations` before the client is signed in. The database policy only lets authenticated users read invitations matching their own email, so unauthenticated first-click visitors cannot validate a perfectly valid pending invite. That makes the UI show the invalid/expired banner immediately.

## Implementation plan
1. **Move invite validation behind a secure backend function**
   - Add a database function such as `get_client_invitation_status(token)` that safely returns only minimal invite status needed by the UI: `valid`, `expired`, `accepted`, or `invalid`, plus the invite email when appropriate.
   - Keep the full `client_invitations` table protected; do not open broad public reads.

2. **Update the auth page invite check**
   - Replace the direct `.from("client_invitations")` browser query in `src/pages/Auth.tsx` with the secure function call.
   - Keep the existing UI behavior: valid invite pre-fills the email, expired invite can request a new sign-in link, invalid invite shows the warning.

3. **Repair invite acceptance reliability**
   - Update `accept_invitation(token)` to enforce that the signed-in user’s email matches the invitation email before linking the account.
   - Keep it as a protected server-side operation so clients cannot claim someone else’s portal.

4. **Check affected pending invites**
   - Verify currently pending invites remain pending and usable.
   - No mass data changes should be needed unless a specific invite is already marked accepted but not linked.

## Files / backend areas involved
- Database migration for the secure invite-status function and stricter acceptance function.
- `src/pages/Auth.tsx` for the invite validation call.
- No changes to generated backend client/type files.