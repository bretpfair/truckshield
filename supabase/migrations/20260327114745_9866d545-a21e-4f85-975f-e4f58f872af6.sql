
CREATE TABLE public.info_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  carrier_name text NOT NULL,
  request_details text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.info_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage info_requests" ON public.info_requests
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view own info_requests" ON public.info_requests
  FOR SELECT USING (account_id IN (SELECT id FROM public.accounts WHERE client_user_id = auth.uid()));

CREATE POLICY "Clients can update own info_requests" ON public.info_requests
  FOR UPDATE USING (account_id IN (SELECT id FROM public.accounts WHERE client_user_id = auth.uid()));
