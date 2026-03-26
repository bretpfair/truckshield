
-- Fix the overly permissive insert policy on notifications
DROP POLICY "System can insert notifications" ON public.notifications;

-- Replace with a policy that allows inserts only for authenticated users or admins
CREATE POLICY "Authenticated can receive notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
