CREATE OR REPLACE FUNCTION public.create_notification_on_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account record;
  v_admin_ids uuid[];
  v_producer_id uuid;
BEGIN
  SELECT array_agg(user_id) INTO v_admin_ids FROM user_roles WHERE role = 'admin';

  IF TG_TABLE_NAME = 'messages' THEN
    SELECT * INTO v_account FROM accounts WHERE id = NEW.account_id;
    v_producer_id := v_account.assigned_producer_id;
    IF NEW.is_staff THEN
      IF v_account.client_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        VALUES (v_account.client_user_id, NEW.account_id, 'new_message',
          'New Message', 'You have a new message from your agent regarding ' || v_account.company_name);
      END IF;
    ELSE
      IF v_admin_ids IS NOT NULL THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        SELECT unnest(v_admin_ids), NEW.account_id, 'new_message',
          'New Client Message', 'New message from client on ' || v_account.company_name;
      END IF;
      IF v_producer_id IS NOT NULL AND (v_admin_ids IS NULL OR NOT (v_producer_id = ANY(v_admin_ids))) THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        VALUES (v_producer_id, NEW.account_id, 'new_message',
          'New Client Message', 'New message from client on ' || v_account.company_name);
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'quotes' THEN
    SELECT * INTO v_account FROM accounts WHERE id = NEW.account_id;
    v_producer_id := v_account.assigned_producer_id;
    IF v_account.client_user_id IS NOT NULL THEN
      IF NEW.status = 'info_requested' AND (OLD IS NULL OR OLD.status != 'info_requested') THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        VALUES (v_account.client_user_id, NEW.account_id, 'info_requested',
          'Action Required', 'A carrier has requested additional information for ' || v_account.company_name);
      ELSIF NEW.status = 'quoted' AND (OLD IS NULL OR OLD.status != 'quoted') THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        VALUES (v_account.client_user_id, NEW.account_id, 'quote_ready',
          'Quotes Are Ready! 🎉', 'Competitive quotes are now available for ' || v_account.company_name || '. Log in to compare.');
      ELSIF NEW.status = 'bound' AND (OLD IS NULL OR OLD.status != 'bound') THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        VALUES (v_account.client_user_id, NEW.account_id, 'policy_bound',
          'Policy Bound — Congratulations!', 'Your policy for ' || v_account.company_name || ' is now officially bound and active.');
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'activity_log' THEN
    -- First login notification for staff
    IF NEW.action_type = 'client_login' AND NEW.description = 'Client signed into the portal for the first time' THEN
      SELECT * INTO v_account FROM accounts WHERE id = NEW.account_id;
      v_producer_id := v_account.assigned_producer_id;
      IF v_admin_ids IS NOT NULL THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        SELECT unnest(v_admin_ids), NEW.account_id, 'first_login',
          'Client First Login', v_account.company_name || ' logged into the portal for the first time!';
      END IF;
      IF v_producer_id IS NOT NULL AND (v_admin_ids IS NULL OR NOT (v_producer_id = ANY(v_admin_ids))) THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        VALUES (v_producer_id, NEW.account_id, 'first_login',
          'Client First Login', v_account.company_name || ' logged into the portal for the first time!');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Add trigger on activity_log for first-login notifications (if not already exists)
DROP TRIGGER IF EXISTS notify_on_activity_log ON public.activity_log;
CREATE TRIGGER notify_on_activity_log
  AFTER INSERT ON public.activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_on_event();