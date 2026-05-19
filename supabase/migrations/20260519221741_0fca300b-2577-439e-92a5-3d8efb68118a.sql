
-- Public-safe invitation status lookup by token (no broad table read access needed)
CREATE OR REPLACE FUNCTION public.get_client_invitation_status(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT email, status, expires_at
    INTO v_inv
  FROM client_invitations
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object('status', 'accepted', 'email', v_inv.email);
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired', 'email', v_inv.email);
  END IF;

  RETURN jsonb_build_object('status', 'valid', 'email', v_inv.email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_client_invitation_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_invitation_status(text) TO anon, authenticated;

-- Harden accept_invitation: require signed-in user email to match the invitation email
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     SET client_user_id = v_user_id
   WHERE id = v_invitation.account_id
     AND (client_user_id IS NULL OR client_user_id = v_user_id);

  UPDATE client_invitations SET status = 'accepted' WHERE id = v_invitation.id;

  INSERT INTO activity_log (account_id, user_id, action_type, description)
  VALUES (v_invitation.account_id, v_user_id, 'client_linked', 'Client accepted invitation and was linked to account');

  RETURN jsonb_build_object('success', true, 'account_id', v_invitation.account_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
