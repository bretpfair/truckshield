
-- Add more fields to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS dba_name text,
  ADD COLUMN IF NOT EXISTS mailing_address text,
  ADD COLUMN IF NOT EXISTS mailing_city text,
  ADD COLUMN IF NOT EXISTS mailing_state text,
  ADD COLUMN IF NOT EXISTS mailing_zip text,
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS business_owner_name text,
  ADD COLUMN IF NOT EXISTS business_owner_dob date,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS ein_tax_id text,
  ADD COLUMN IF NOT EXISTS date_of_authority date,
  ADD COLUMN IF NOT EXISTS carrier_authority_prefix text,
  ADD COLUMN IF NOT EXISTS carrier_authority_number text,
  ADD COLUMN IF NOT EXISTS business_categories text[],
  ADD COLUMN IF NOT EXISTS contractor_types text[],
  ADD COLUMN IF NOT EXISTS total_garage_locations integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_trucks integer,
  ADD COLUMN IF NOT EXISTS total_owned_trailers integer,
  ADD COLUMN IF NOT EXISTS total_nonowned_trailers integer,
  ADD COLUMN IF NOT EXISTS total_drivers integer,
  ADD COLUMN IF NOT EXISTS requested_effective_date date,
  ADD COLUMN IF NOT EXISTS projected_gross_receipts numeric,
  ADD COLUMN IF NOT EXISTS total_annual_revenue numeric,
  ADD COLUMN IF NOT EXISTS total_subhaul_revenue numeric,
  ADD COLUMN IF NOT EXISTS coverage_selections jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS radius_operations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS commodity_info jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS general_questions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS application_step integer DEFAULT 1;

-- Garage locations table
CREATE TABLE public.garage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  is_principal boolean DEFAULT false,
  address text,
  city text,
  state text,
  zip text,
  county text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.garage_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage garage_locations" ON public.garage_locations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clients can manage own garage_locations" ON public.garage_locations FOR ALL USING (account_id IN (SELECT id FROM public.accounts WHERE client_user_id = auth.uid()));

-- Power units table
CREATE TABLE public.power_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  vin text,
  gvw_class text,
  truck_type text,
  is_service_vehicle boolean DEFAULT false,
  year text,
  make text,
  model text,
  titled_state text,
  garage_zip text,
  roadside_assistance boolean DEFAULT false,
  has_physdam boolean DEFAULT false,
  physdam_amount numeric,
  has_cargo boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.power_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage power_units" ON public.power_units FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clients can manage own power_units" ON public.power_units FOR ALL USING (account_id IN (SELECT id FROM public.accounts WHERE client_user_id = auth.uid()));

-- Trailers table
CREATE TABLE public.trailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  vin text,
  is_nonowned boolean DEFAULT false,
  trailer_type text,
  year text,
  make text,
  model text,
  garage_zip text,
  has_physdam boolean DEFAULT false,
  physdam_amount numeric,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trailers" ON public.trailers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clients can manage own trailers" ON public.trailers FOR ALL USING (account_id IN (SELECT id FROM public.accounts WHERE client_user_id = auth.uid()));

-- Drivers table
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  date_of_birth date,
  driver_type text,
  license_number text,
  license_state text,
  license_type text,
  original_issue_month integer,
  original_issue_year integer,
  date_hired_month integer,
  date_hired_year integer,
  experience_years integer,
  experience_months integer,
  lapse_suspension text,
  lapse_explanation text,
  num_violations integer DEFAULT 0,
  violations jsonb DEFAULT '[]'::jsonb,
  num_accidents integer DEFAULT 0,
  accidents jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage drivers" ON public.drivers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clients can manage own drivers" ON public.drivers FOR ALL USING (account_id IN (SELECT id FROM public.accounts WHERE client_user_id = auth.uid()));

-- Loss history table
CREATE TABLE public.loss_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  coverage_type text NOT NULL,
  no_prior_coverage boolean DEFAULT false,
  policy_terms jsonb DEFAULT '[]'::jsonb,
  cancelled_nonrenewed boolean DEFAULT false,
  cancellation_reason text,
  cancellation_reason_other text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loss_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage loss_history" ON public.loss_history FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clients can manage own loss_history" ON public.loss_history FOR ALL USING (account_id IN (SELECT id FROM public.accounts WHERE client_user_id = auth.uid()));
