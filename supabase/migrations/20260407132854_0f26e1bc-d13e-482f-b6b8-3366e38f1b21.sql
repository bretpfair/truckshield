-- Fix 1: Prevent authenticated users from self-assigning roles (privilege escalation)
-- Add a restrictive INSERT policy that only allows admins and service_role to insert
CREATE POLICY "Only admins and service_role can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 2: Prevent clients from spoofing is_staff on messages
-- Drop existing permissive policy and replace with one that enforces is_staff = false
DROP POLICY IF EXISTS "Clients can send messages on own accounts" ON public.messages;

CREATE POLICY "Clients can send messages on own accounts"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_staff = false
  AND account_id IN (
    SELECT id FROM accounts WHERE client_user_id = auth.uid()
  )
);