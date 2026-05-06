
-- Revoke default PUBLIC execute grants on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_invite_on_producer_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_update_account_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification_on_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_client_account_updates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;

-- Storage: lock down carrier-logos public bucket listing.
-- Drop any broad SELECT policies that allow listing the bucket.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%carrier-logos%' OR policyname ILIKE '%carrier%logo%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Allow public read of individual objects (so <img src=...> works) but no listing
CREATE POLICY "Public can read carrier logo objects"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'carrier-logos');

-- Staff can manage logos
CREATE POLICY "Staff can manage carrier logos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'carrier-logos'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'producer'))
)
WITH CHECK (
  bucket_id = 'carrier-logos'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'producer'))
);
