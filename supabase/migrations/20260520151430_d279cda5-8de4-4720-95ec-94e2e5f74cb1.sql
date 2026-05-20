
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation record;
  v_user_id uuid;
  v_user_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  v_user_email := lower(coalesce(auth.jwt()->>'email', ''));

  SELECT * INTO v_invitation FROM client_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > now();

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invitation');
  END IF;

  IF v_user_email = '' OR lower(v_invitation.email) <> v_user_email THEN
    RETURN jsonb_build_object('error', 'This invitation was sent to a different email address.');
  END IF;

  -- Link client to account (only if not already linked to someone else)
  UPDATE accounts
     SET client_user_id = v_user_id,
         contact_email = COALESCE(NULLIF(contact_email, ''), v_invitation.email)
   WHERE id = v_invitation.account_id
     AND (client_user_id IS NULL OR client_user_id = v_user_id);

  UPDATE client_invitations SET status = 'accepted' WHERE id = v_invitation.id;

  INSERT INTO activity_log (account_id, user_id, action_type, description)
  VALUES (v_invitation.account_id, v_user_id, 'client_linked', 'Client accepted invitation and was linked to account');

  RETURN jsonb_build_object('success', true, 'account_id', v_invitation.account_id);
END;
$function$;
