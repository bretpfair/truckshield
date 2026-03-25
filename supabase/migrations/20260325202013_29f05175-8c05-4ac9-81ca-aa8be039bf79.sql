ALTER TABLE public.power_units
  ADD COLUMN ownership_type text DEFAULT 'owned',
  ADD COLUMN lender_name text,
  ADD COLUMN lender_address text,
  ADD COLUMN lender_city text,
  ADD COLUMN lender_state text,
  ADD COLUMN lender_zip text;