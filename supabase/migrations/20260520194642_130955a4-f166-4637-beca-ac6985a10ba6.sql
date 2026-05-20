
CREATE OR REPLACE FUNCTION public.email_send_log_account_id(_metadata jsonb)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_raw text;
  v_uuid uuid;
BEGIN
  IF _metadata IS NULL THEN RETURN NULL; END IF;
  v_raw := _metadata->>'account_id';
  IF v_raw IS NULL OR length(v_raw) < 32 THEN RETURN NULL; END IF;
  BEGIN
    v_uuid := v_raw::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN v_uuid;
END;
$$;

DROP POLICY IF EXISTS "Admins can read email send log" ON public.email_send_log;
CREATE POLICY "Admins can read email send log"
  ON public.email_send_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Producers can read assigned email send log" ON public.email_send_log;
CREATE POLICY "Producers can read assigned email send log"
  ON public.email_send_log FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'producer')
    AND public.email_send_log_account_id(metadata) IN (
      SELECT a.id FROM public.accounts a
      WHERE a.assigned_producer_id = auth.uid()
    )
  );
