CREATE OR REPLACE FUNCTION public.accept_staff_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation record;
  v_user_id uuid;
  v_user_email text;
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

  -- Ensure profile exists and has the correct email
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  
  INSERT INTO profiles (user_id, email)
  VALUES (v_user_id, v_user_email)
  ON CONFLICT (user_id) DO UPDATE SET email = COALESCE(profiles.email, EXCLUDED.email);

  RETURN jsonb_build_object('success', true, 'role', v_role::text);
END;
$function$;