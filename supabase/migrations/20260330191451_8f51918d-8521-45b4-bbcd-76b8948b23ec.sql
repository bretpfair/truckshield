
-- Allow producers to SELECT unassigned accounts
CREATE POLICY "Producers can view unassigned accounts"
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (assigned_producer_id IS NULL AND has_role(auth.uid(), 'producer'::app_role));

-- Allow producers to UPDATE unassigned accounts (to assign themselves)
CREATE POLICY "Producers can update unassigned accounts"
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (assigned_producer_id IS NULL AND has_role(auth.uid(), 'producer'::app_role));

-- Update guard trigger to allow producers to assign themselves to unassigned accounts
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
  
  -- Allow service_role, superuser, or trigger context (NULL uid)
  IF v_uid IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Check if the current user is admin or producer
  v_is_staff := (
    has_role(v_uid, 'admin') OR has_role(v_uid, 'producer')
  );

  IF v_is_staff THEN
    -- Producers can only assign themselves to unassigned accounts
    IF has_role(v_uid, 'producer') AND NOT has_role(v_uid, 'admin') THEN
      -- If account was unassigned, only allow assigning to self
      IF OLD.assigned_producer_id IS NULL AND NEW.assigned_producer_id IS NOT NULL AND NEW.assigned_producer_id != v_uid THEN
        NEW.assigned_producer_id := OLD.assigned_producer_id;
      END IF;
      -- If account was assigned to someone else, don't allow reassignment
      IF OLD.assigned_producer_id IS NOT NULL AND OLD.assigned_producer_id != v_uid THEN
        NEW.assigned_producer_id := OLD.assigned_producer_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- If not staff, reset all protected fields to their original values
  NEW.status := OLD.status;
  NEW.assigned_producer_id := OLD.assigned_producer_id;
  NEW.created_by := OLD.created_by;
  NEW.client_user_id := OLD.client_user_id;
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$function$;

-- Allow producers to view related data for unassigned accounts
CREATE POLICY "Producers can view unassigned account quotes"
  ON public.quotes
  FOR SELECT
  TO authenticated
  USING (
    (account_id IN (SELECT id FROM accounts WHERE assigned_producer_id IS NULL))
    AND has_role(auth.uid(), 'producer'::app_role)
  );

CREATE POLICY "Producers can view unassigned activity_log"
  ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (
    (account_id IN (SELECT id FROM accounts WHERE assigned_producer_id IS NULL))
    AND has_role(auth.uid(), 'producer'::app_role)
  );

CREATE POLICY "Producers can view unassigned account messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    (account_id IN (SELECT id FROM accounts WHERE assigned_producer_id IS NULL))
    AND has_role(auth.uid(), 'producer'::app_role)
  );

CREATE POLICY "Producers can view unassigned account documents"
  ON public.account_documents
  FOR SELECT
  TO authenticated
  USING (
    (account_id IN (SELECT id FROM accounts WHERE assigned_producer_id IS NULL))
    AND has_role(auth.uid(), 'producer'::app_role)
  );

CREATE POLICY "Producers can view unassigned account tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    (account_id IN (SELECT id FROM accounts WHERE assigned_producer_id IS NULL))
    AND has_role(auth.uid(), 'producer'::app_role)
  );
