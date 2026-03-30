
-- Fix the guard trigger to also allow service_role and superuser (NULL auth.uid()) contexts
CREATE OR REPLACE FUNCTION public.guard_client_account_updates()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
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

  -- If not staff, reset all protected fields to their original values
  IF NOT v_is_staff THEN
    NEW.status := OLD.status;
    NEW.assigned_producer_id := OLD.assigned_producer_id;
    NEW.created_by := OLD.created_by;
    NEW.client_user_id := OLD.client_user_id;
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

-- Now fix the stuck account
UPDATE public.accounts
SET status = 'quoted'
WHERE id = 'd331b36e-b7b1-491b-8635-c3b1829ac8fc';

INSERT INTO public.activity_log (account_id, action_type, description)
VALUES ('d331b36e-b7b1-491b-8635-c3b1829ac8fc', 'status_change', 'Status corrected to Quoted (guard trigger was blocking auto-updates)');
