CREATE TABLE public.market_guidance_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_guidance_account ON public.market_guidance_results(account_id);

-- Only keep the latest per account (we'll upsert via unique constraint)
CREATE UNIQUE INDEX idx_market_guidance_account_unique ON public.market_guidance_results(account_id);

ALTER TABLE public.market_guidance_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage market_guidance_results"
ON public.market_guidance_results
FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view own market_guidance_results"
ON public.market_guidance_results
FOR SELECT
TO public
USING (account_id IN (SELECT id FROM accounts WHERE client_user_id = auth.uid()));