
-- Activity Log table for tracking events per account
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid,
  action_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage activity_log"
  ON public.activity_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_activity_log_account ON public.activity_log(account_id, created_at DESC);

-- Client invitations table
CREATE TABLE public.client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invitations"
  ON public.client_invitations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read own invitation by token"
  ON public.client_invitations FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_invitations_token ON public.client_invitations(token);
CREATE INDEX idx_invitations_email ON public.client_invitations(email);

-- Function to auto-update account status based on events
CREATE OR REPLACE FUNCTION public.auto_update_account_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_current_status text;
  v_new_status text;
  v_quote_count int;
  v_quoted_count int;
BEGIN
  -- Determine account_id and context
  IF TG_TABLE_NAME = 'accounts' THEN
    v_account_id := NEW.id;
    v_current_status := OLD.status;
    -- If application step reaches 10, move from pending_info to info_complete
    IF NEW.application_step >= 10 AND OLD.application_step < 10 AND v_current_status = 'pending_info' THEN
      NEW.status := 'info_complete';
      INSERT INTO activity_log (account_id, action_type, description)
      VALUES (v_account_id, 'status_change', 'Status auto-updated to Info Complete (application completed)');
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_account_id := NEW.account_id;
    SELECT status INTO v_current_status FROM accounts WHERE id = v_account_id;
    
    -- When a quote is first submitted, move to quoting
    IF NEW.status = 'submitted' AND (OLD IS NULL OR OLD.status != 'submitted') THEN
      IF v_current_status IN ('lead', 'pending_info', 'info_complete') THEN
        UPDATE accounts SET status = 'quoting' WHERE id = v_account_id;
        INSERT INTO activity_log (account_id, action_type, description)
        VALUES (v_account_id, 'status_change', 'Status auto-updated to Quoting (first quote submitted)');
      END IF;
    END IF;
    
    -- When a quote is marked quoted, move to quoted
    IF NEW.status = 'quoted' AND (OLD IS NULL OR OLD.status != 'quoted') THEN
      IF v_current_status = 'quoting' THEN
        UPDATE accounts SET status = 'quoted' WHERE id = v_account_id;
        INSERT INTO activity_log (account_id, action_type, description)
        VALUES (v_account_id, 'status_change', 'Status auto-updated to Quoted (quote received)');
      END IF;
    END IF;
    
    -- When a quote is bound, move to bound
    IF NEW.status = 'bound' AND (OLD IS NULL OR OLD.status != 'bound') THEN
      UPDATE accounts SET status = 'bound' WHERE id = v_account_id;
      INSERT INTO activity_log (account_id, action_type, description)
      VALUES (v_account_id, 'status_change', 'Status auto-updated to Bound');
    END IF;
    
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on accounts for application step changes
CREATE TRIGGER trg_account_auto_status
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_status();

-- Trigger on quotes for status changes
CREATE TRIGGER trg_quote_auto_status
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_status();

-- Function to accept invitation and link client to account
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  
  SELECT * INTO v_invitation FROM client_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > now();
  
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invitation');
  END IF;
  
  -- Link client to account
  UPDATE accounts SET client_user_id = v_user_id WHERE id = v_invitation.account_id;
  
  -- Mark invitation as accepted
  UPDATE client_invitations SET status = 'accepted' WHERE id = v_invitation.id;
  
  -- Log activity
  INSERT INTO activity_log (account_id, user_id, action_type, description)
  VALUES (v_invitation.account_id, v_user_id, 'client_linked', 'Client accepted invitation and was linked to account');
  
  RETURN jsonb_build_object('success', true, 'account_id', v_invitation.account_id);
END;
$$;
