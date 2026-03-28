CREATE OR REPLACE FUNCTION public.auto_update_account_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account_id uuid;
  v_current_status text;
  v_new_status text;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_service_role_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF TG_TABLE_NAME = 'accounts' THEN
    v_account_id := NEW.id;
    v_current_status := OLD.status;
    IF NEW.application_step >= 10 AND OLD.application_step < 10 AND v_current_status = 'pending_info' THEN
      NEW.status := 'info_complete';
      INSERT INTO activity_log (account_id, action_type, description)
      VALUES (v_account_id, 'status_change', 'Status auto-updated to Info Complete (application completed)');

      IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/notify-status-change',
          body := jsonb_build_object('account_id', v_account_id::text, 'new_status', 'info_complete'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          )
        );
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_account_id := NEW.account_id;
    SELECT status INTO v_current_status FROM accounts WHERE id = v_account_id;

    IF NEW.status = 'submitted' AND (OLD IS NULL OR OLD.status != 'submitted') THEN
      IF v_current_status IN ('lead', 'pending_info', 'info_complete') THEN
        UPDATE accounts SET status = 'quoting' WHERE id = v_account_id;
        INSERT INTO activity_log (account_id, action_type, description)
        VALUES (v_account_id, 'status_change', 'Status auto-updated to Quoting (first quote submitted)');

        IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/notify-status-change',
            body := jsonb_build_object('account_id', v_account_id::text, 'new_status', 'quoting'),
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_service_role_key
            )
          );
        END IF;
      END IF;
    END IF;

    IF NEW.status = 'quoted' AND (OLD IS NULL OR OLD.status != 'quoted') THEN
      IF v_current_status = 'quoting' THEN
        UPDATE accounts SET status = 'quoted' WHERE id = v_account_id;
        INSERT INTO activity_log (account_id, action_type, description)
        VALUES (v_account_id, 'status_change', 'Status auto-updated to Quoted (quote received)');

        IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/notify-status-change',
            body := jsonb_build_object('account_id', v_account_id::text, 'new_status', 'quoted'),
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_service_role_key
            )
          );
        END IF;
      END IF;
    END IF;

    IF NEW.status = 'bound' AND (OLD IS NULL OR OLD.status != 'bound') THEN
      UPDATE accounts SET status = 'bound' WHERE id = v_account_id;
      INSERT INTO activity_log (account_id, action_type, description)
      VALUES (v_account_id, 'status_change', 'Status auto-updated to Bound');

      IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/notify-status-change',
          body := jsonb_build_object('account_id', v_account_id::text, 'new_status', 'bound'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          )
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;