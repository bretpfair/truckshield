
CREATE POLICY "Producers can manage unassigned power_units"
ON public.power_units
FOR ALL
USING (
  (account_id IN (SELECT id FROM accounts WHERE assigned_producer_id IS NULL))
  AND has_role(auth.uid(), 'producer'::app_role)
)
WITH CHECK (
  (account_id IN (SELECT id FROM accounts WHERE assigned_producer_id IS NULL))
  AND has_role(auth.uid(), 'producer'::app_role)
);
