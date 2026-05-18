ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_status_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_status_check CHECK (status = ANY (ARRAY['lead'::text, 'pending_info'::text, 'info_complete'::text, 'quoting'::text, 'quoted'::text, 'bound'::text, 'declined'::text, 'closed_lost'::text]));
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS close_lost_reason text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS close_lost_reason_detail text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS closed_lost_at timestamp with time zone;