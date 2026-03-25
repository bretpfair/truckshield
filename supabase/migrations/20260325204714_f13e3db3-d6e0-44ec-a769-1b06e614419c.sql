
-- Create storage bucket for loss run documents
INSERT INTO storage.buckets (id, name, public) VALUES ('loss-runs', 'loss-runs', false);

-- Allow authenticated users to upload to their account folder
CREATE POLICY "Users can upload loss runs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'loss-runs');

-- Allow users to view their own uploads
CREATE POLICY "Users can view loss runs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'loss-runs');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete loss runs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'loss-runs');
