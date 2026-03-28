
-- Add assigned_producer_id column to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS assigned_producer_id uuid;

-- Add role column to staff_invitations
ALTER TABLE public.staff_invitations ADD COLUMN IF NOT EXISTS invited_role text NOT NULL DEFAULT 'admin';

-- RLS: Producers can manage their assigned accounts
CREATE POLICY "Producers can manage assigned accounts"
ON public.accounts FOR ALL TO public
USING (assigned_producer_id = auth.uid() AND public.has_role(auth.uid(), 'producer'));

-- RLS: Producers on child tables
CREATE POLICY "Producers can manage assigned account quotes"
ON public.quotes FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned activity_log"
ON public.activity_log FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned tasks"
ON public.tasks FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned messages"
ON public.messages FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned drivers"
ON public.drivers FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned power_units"
ON public.power_units FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned trailers"
ON public.trailers FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned loss_history"
ON public.loss_history FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned account_documents"
ON public.account_documents FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned info_requests"
ON public.info_requests FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned garage_locations"
ON public.garage_locations FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

CREATE POLICY "Producers can manage assigned market_guidance_results"
ON public.market_guidance_results FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

-- Producers can view all profiles
CREATE POLICY "Producers can view all profiles"
ON public.profiles FOR SELECT TO public
USING (public.has_role(auth.uid(), 'producer'));

-- Producers can manage client_invitations for their accounts
CREATE POLICY "Producers can manage assigned client_invitations"
ON public.client_invitations FOR ALL TO public
USING (account_id IN (SELECT id FROM public.accounts WHERE assigned_producer_id = auth.uid()) AND public.has_role(auth.uid(), 'producer'));

-- Update accept_staff_invitation to support role from invitation
CREATE OR REPLACE FUNCTION public.accept_staff_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation record;
  v_user_id uuid;
  v_role app_role;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invitation FROM staff_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > now();

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invitation');
  END IF;

  v_role := COALESCE(v_invitation.invited_role, 'admin')::app_role;

  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE staff_invitations SET status = 'accepted' WHERE id = v_invitation.id;

  RETURN jsonb_build_object('success', true, 'role', v_role::text);
END;
$function$;

-- Update notification trigger to also notify assigned producer
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
      -- Also notify producer if not already an admin
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
          'Quote Available', 'A new quote is available for ' || v_account.company_name);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
