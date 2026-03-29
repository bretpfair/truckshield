
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logged_in_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all login_history"
  ON public.login_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own login_history"
  ON public.login_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert own login_history"
  ON public.login_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
