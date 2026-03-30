
-- Create a trigger that prevents clients from modifying protected fields
-- Protected fields are reset to their OLD values if the updater is a client
CREATE OR REPLACE FUNCTION public.guard_client_account_updates()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  -- Check if the current user is admin or producer
  v_is_staff := (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'producer')
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

CREATE TRIGGER guard_client_account_updates_trigger
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_client_account_updates();
