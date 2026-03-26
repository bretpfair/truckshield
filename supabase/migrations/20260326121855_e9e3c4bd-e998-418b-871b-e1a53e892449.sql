ALTER TABLE public.carriers
  ADD COLUMN IF NOT EXISTS min_years_in_business integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_authority_age_months integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_annual_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_annual_revenue numeric DEFAULT 999999999,
  ADD COLUMN IF NOT EXISTS accepted_business_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS excluded_cargo_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS excluded_states text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_radius_pct_over500 integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS requires_authority boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS appetite_pdf_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('appetite-guides', 'appetite-guides', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can manage appetite guides"
ON storage.objects FOR ALL
USING (bucket_id = 'appetite-guides' AND public.has_role(auth.uid(), 'admin'::app_role));