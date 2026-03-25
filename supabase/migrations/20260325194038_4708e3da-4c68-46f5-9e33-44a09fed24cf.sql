
-- Create storage bucket for cab cards / registration uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('cab-cards', 'cab-cards', false);

-- Allow authenticated users to upload to cab-cards bucket
CREATE POLICY "Authenticated users can upload cab cards"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cab-cards');

-- Allow users to view their own uploads (via power_units ownership)
CREATE POLICY "Users can view own cab cards"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cab-cards');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own cab cards"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cab-cards');

-- Add cab_card_path column to power_units
ALTER TABLE public.power_units ADD COLUMN cab_card_path text DEFAULT NULL;
