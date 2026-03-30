
-- ============================================================
-- 1. FIX: client_invitations - restrict SELECT to admin/producer/own token
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read own invitation by token" ON public.client_invitations;

-- Allow any authenticated user to look up an invitation by matching their email
CREATE POLICY "Users can read own invitations by email"
  ON public.client_invitations
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ============================================================
-- 2. FIX: staff_invitations - restrict SELECT to admin or own email
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read staff invitations" ON public.staff_invitations;

CREATE POLICY "Users can read own staff invitations by email"
  ON public.staff_invitations
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ============================================================
-- 3. FIX: notifications - restrict INSERT to service_role or own user_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can receive notifications" ON public.notifications;

CREATE POLICY "Service role can insert notifications"
  ON public.notifications
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4. FIX: Storage - cab-cards policies with account ownership
-- ============================================================
DROP POLICY IF EXISTS "Users can view own cab cards" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own cab cards" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cab cards" ON storage.objects;

-- Cab cards: account-scoped access via power_units table path matching
CREATE POLICY "Account owners can view cab cards"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cab-cards'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

CREATE POLICY "Account owners can upload cab cards"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cab-cards'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

CREATE POLICY "Account owners can delete cab cards"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cab-cards'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

-- ============================================================
-- 5. FIX: Storage - loss-runs policies with account ownership
-- ============================================================
DROP POLICY IF EXISTS "Users can view loss runs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload loss runs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete loss runs" ON storage.objects;

CREATE POLICY "Account owners can view loss runs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'loss-runs'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

CREATE POLICY "Account owners can upload loss runs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'loss-runs'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

CREATE POLICY "Account owners can delete loss runs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'loss-runs'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

-- ============================================================
-- 6. FIX: Storage - account-documents with account ownership
-- ============================================================
DROP POLICY IF EXISTS "Clients can view own account-documents" ON storage.objects;
DROP POLICY IF EXISTS "Clients can upload to account-documents" ON storage.objects;

CREATE POLICY "Account owners can view account-documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'account-documents'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

CREATE POLICY "Account owners can upload account-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'account-documents'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

-- ============================================================
-- 7. FIX: Storage - client-documents with account ownership
-- ============================================================
DROP POLICY IF EXISTS "Clients can view own client documents" ON storage.objects;
DROP POLICY IF EXISTS "Clients can upload client documents" ON storage.objects;

CREATE POLICY "Account owners can view client-documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-documents'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

CREATE POLICY "Account owners can upload client-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'producer')
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.client_user_id = auth.uid()
          AND name LIKE a.id::text || '/%'
      )
    )
  );

-- ============================================================
-- 8. FIX: Mutable search_path on email queue functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;
