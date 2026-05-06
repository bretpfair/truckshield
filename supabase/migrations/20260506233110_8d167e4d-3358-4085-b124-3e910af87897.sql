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
  -- Allow clients to claim an unassigned account by setting client_user_id to themselves
  -- (this happens via accept_invitation SECURITY DEFINER fn). Otherwise, lock it.
  IF NOT (OLD.client_user_id IS NULL AND NEW.client_user_id = v_uid) THEN
    NEW.client_user_id := OLD.client_user_id;
  END IF;
  NEW.created_at := OLD.created_at;
  -- Regulated identifiers — once set, clients cannot change them
  IF OLD.dot_number IS NOT NULL THEN NEW.dot_number := OLD.dot_number; END IF;
  IF OLD.mc_number IS NOT NULL THEN NEW.mc_number := OLD.mc_number; END IF;
  IF OLD.ein_tax_id IS NOT NULL THEN NEW.ein_tax_id := OLD.ein_tax_id; END IF;

  RETURN NEW;
END;
$function$;

-- Repair: re-link any invitations that were marked accepted but whose account was never linked
UPDATE accounts a
SET client_user_id = ci.invited_user_id
FROM (
  SELECT DISTINCT ON (ci.account_id)
    ci.account_id,
    al.user_id AS invited_user_id
  FROM client_invitations ci
  JOIN activity_log al
    ON al.account_id = ci.account_id
   AND al.action_type = 'client_linked'
  WHERE ci.status = 'accepted'
  ORDER BY ci.account_id, al.created_at DESC
) ci
WHERE a.id = ci.account_id
  AND a.client_user_id IS NULL
  AND ci.invited_user_id IS NOT NULL;