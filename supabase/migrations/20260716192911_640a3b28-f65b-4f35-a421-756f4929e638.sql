
-- Tighten carriers SELECT: staff-only on the base table
DROP POLICY IF EXISTS "Authenticated users can view active carriers" ON public.carriers;

CREATE POLICY "Staff can view carriers"
  ON public.carriers FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'producer'::app_role)
  );

-- Safe public view for clients: only non-sensitive identity fields, active carriers only.
-- Runs with definer privileges (default) so it can bypass base-table RLS while
-- exposing ONLY id, name, logo_path.
CREATE OR REPLACE VIEW public.carriers_public AS
  SELECT id, name, logo_path
  FROM public.carriers
  WHERE is_active = true;

GRANT SELECT ON public.carriers_public TO authenticated, anon;
