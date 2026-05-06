
-- ============================================================
-- 1. Account update guard trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_guard_client_account_updates ON public.accounts;
CREATE TRIGGER trg_guard_client_account_updates
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.guard_client_account_updates();

-- Also restrict client mutation of regulated identifiers (kept inside guard fn would change behavior for staff;
-- handle here by extending the guard function to also lock dot/mc/ein for clients).
CREATE OR REPLACE FUNCTION public.guard_client_account_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_staff boolean;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  
  -- Allow service_role or trigger context (NULL uid)
  IF v_uid IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_is_staff := (
    has_role(v_uid, 'admin') OR has_role(v_uid, 'producer')
  );

  IF v_is_staff THEN
    -- Producers can only assign themselves to unassigned accounts
    IF has_role(v_uid, 'producer') AND NOT has_role(v_uid, 'admin') THEN
      IF OLD.assigned_producer_id IS NULL AND NEW.assigned_producer_id IS NOT NULL AND NEW.assigned_producer_id != v_uid THEN
        NEW.assigned_producer_id := OLD.assigned_producer_id;
      END IF;
      IF OLD.assigned_producer_id IS NOT NULL AND OLD.assigned_producer_id != v_uid THEN
        NEW.assigned_producer_id := OLD.assigned_producer_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Non-staff (clients): lock all privileged + regulated fields
  NEW.status := OLD.status;
  NEW.assigned_producer_id := OLD.assigned_producer_id;
  NEW.created_by := OLD.created_by;
  NEW.client_user_id := OLD.client_user_id;
  NEW.created_at := OLD.created_at;
  -- Regulated identifiers — once set, clients cannot change them
  IF OLD.dot_number IS NOT NULL THEN NEW.dot_number := OLD.dot_number; END IF;
  IF OLD.mc_number IS NOT NULL THEN NEW.mc_number := OLD.mc_number; END IF;
  IF OLD.ein_tax_id IS NOT NULL THEN NEW.ein_tax_id := OLD.ein_tax_id; END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. user_roles: tighten policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Replace authenticated-only restrictive insert with public-scope
DROP POLICY IF EXISTS "Only admins and service_role can insert roles" ON public.user_roles;
CREATE POLICY "Only admins and service_role can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.role() = 'service_role'
);

-- ============================================================
-- 3. activity_log: client SELECT policy
-- ============================================================
CREATE POLICY "Clients can view own activity_log"
ON public.activity_log
FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT id FROM accounts WHERE client_user_id = auth.uid()
  )
);

-- ============================================================
-- 4. Storage policies: client-documents DELETE/UPDATE
-- ============================================================
CREATE POLICY "Account owners can delete own client documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM accounts WHERE client_user_id = auth.uid()
  )
);

CREATE POLICY "Account owners can update own client documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM accounts WHERE client_user_id = auth.uid()
  )
);

CREATE POLICY "Staff can manage client documents"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'producer'))
)
WITH CHECK (
  bucket_id = 'client-documents'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'producer'))
);

-- ============================================================
-- 5. Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER fns
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_invite_on_producer_assignment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_update_account_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification_on_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_client_account_updates() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
-- accept_invitation, accept_staff_invitation, has_role remain callable (needed by app)
