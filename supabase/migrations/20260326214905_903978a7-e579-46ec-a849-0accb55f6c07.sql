
-- Messages table for client-agency communication
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  is_staff boolean NOT NULL DEFAULT false,
  attachment_path text,
  attachment_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage messages"
ON public.messages FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients can view messages on their accounts
CREATE POLICY "Clients can view own account messages"
ON public.messages FOR SELECT
TO public
USING (account_id IN (
  SELECT id FROM public.accounts WHERE client_user_id = auth.uid()
));

-- Clients can insert messages on their accounts
CREATE POLICY "Clients can send messages on own accounts"
ON public.messages FOR INSERT
TO public
WITH CHECK (
  sender_id = auth.uid()
  AND account_id IN (
    SELECT id FROM public.accounts WHERE client_user_id = auth.uid()
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Client documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', false);

-- Storage policies for client-documents bucket
CREATE POLICY "Admins can manage client documents"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'client-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can upload client documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'client-documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Clients can view own client documents"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'client-documents'
  AND auth.uid() IS NOT NULL
);

-- Update quotes status constraint to include info_requested
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check 
  CHECK (status IN ('draft', 'submitted', 'reviewing', 'info_requested', 'quoted', 'bound', 'declined', 'published'));

-- Update quotes RLS to let clients see more statuses
DROP POLICY IF EXISTS "Clients can view published quotes for their accounts" ON public.quotes;
CREATE POLICY "Clients can view quotes for their accounts"
ON public.quotes FOR SELECT
TO public
USING (
  account_id IN (
    SELECT id FROM public.accounts WHERE client_user_id = auth.uid()
  )
  AND status IN ('submitted', 'reviewing', 'info_requested', 'quoted', 'bound', 'declined')
);
