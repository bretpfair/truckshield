
-- Cover Whale submissions tracking table
CREATE TABLE public.coverwhale_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  submission_number text NOT NULL,
  status text NOT NULL DEFAULT 'quoted',
  quote_pdf_url text,
  coverages_data jsonb DEFAULT '{}'::jsonb,
  total_premium numeric,
  api_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.coverwhale_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coverwhale_submissions"
  ON public.coverwhale_submissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Producers can manage assigned coverwhale_submissions"
  ON public.coverwhale_submissions FOR ALL
  USING (
    account_id IN (SELECT id FROM accounts WHERE assigned_producer_id = auth.uid())
    AND has_role(auth.uid(), 'producer'::app_role)
  );

CREATE POLICY "Producers can view unassigned coverwhale_submissions"
  ON public.coverwhale_submissions FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT id FROM accounts WHERE assigned_producer_id IS NULL)
    AND has_role(auth.uid(), 'producer'::app_role)
  );

-- Updated at trigger
CREATE TRIGGER update_coverwhale_submissions_updated_at
  BEFORE UPDATE ON public.coverwhale_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
