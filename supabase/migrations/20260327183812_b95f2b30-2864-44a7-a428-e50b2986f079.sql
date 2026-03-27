
-- Staff invitations table
CREATE TABLE public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text),
  invited_by uuid,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, status)
);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage staff invitations
CREATE POLICY "Admins can manage staff_invitations"
  ON public.staff_invitations FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Authenticated users can read their own invitation by token
CREATE POLICY "Authenticated can read staff invitations"
  ON public.staff_invitations FOR SELECT
  TO authenticated
  USING (true);

-- Function to accept a staff invitation and assign admin role
CREATE OR REPLACE FUNCTION public.accept_staff_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation record;
  v_user_id uuid;
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

  -- Assign admin role (ignore if already has it)
  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Mark invitation as accepted
  UPDATE staff_invitations SET status = 'accepted' WHERE id = v_invitation.id;

  RETURN jsonb_build_object('success', true);
END;
$$;
