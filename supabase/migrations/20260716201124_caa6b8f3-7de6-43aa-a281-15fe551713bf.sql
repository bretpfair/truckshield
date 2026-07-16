CREATE TABLE public.coverwhale_token_cache (
  id smallint PRIMARY KEY DEFAULT 1,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coverwhale_token_cache_singleton CHECK (id = 1)
);
GRANT ALL ON public.coverwhale_token_cache TO service_role;
ALTER TABLE public.coverwhale_token_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to CW token cache"
  ON public.coverwhale_token_cache FOR ALL
  USING (false) WITH CHECK (false);