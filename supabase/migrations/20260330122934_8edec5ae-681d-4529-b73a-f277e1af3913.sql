
-- Fix staff_invitations RLS: use auth.jwt() instead of querying auth.users
DROP POLICY IF EXISTS "Users can read own staff invitations by email" ON public.staff_invitations;
CREATE POLICY "Users can read own staff invitations by email"
  ON public.staff_invitations
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email'));

-- Fix client_invitations RLS: same issue
DROP POLICY IF EXISTS "Users can read own invitations by email" ON public.client_invitations;
CREATE POLICY "Users can read own invitations by email"
  ON public.client_invitations
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email'));
