
CREATE POLICY "Clients can insert own activity_log"
ON public.activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (
    SELECT id FROM accounts WHERE client_user_id = auth.uid()
  )
);
