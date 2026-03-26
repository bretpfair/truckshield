ALTER TABLE public.carriers
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS logo_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('carrier-logos', 'carrier-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can manage carrier logos"
ON storage.objects FOR ALL
USING (bucket_id = 'carrier-logos' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view carrier logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'carrier-logos');