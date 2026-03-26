
-- Account documents table for centralized document hub
CREATE TABLE public.account_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  uploaded_by uuid,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  category text NOT NULL DEFAULT 'misc',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.account_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage account_documents"
  ON public.account_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view own account documents"
  ON public.account_documents FOR SELECT
  USING (account_id IN (SELECT id FROM accounts WHERE client_user_id = auth.uid()));

CREATE POLICY "Clients can upload own account documents"
  ON public.account_documents FOR INSERT
  WITH CHECK (account_id IN (SELECT id FROM accounts WHERE client_user_id = auth.uid()));

CREATE INDEX idx_account_documents_account ON public.account_documents(account_id, created_at DESC);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- account-documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('account-documents', 'account-documents', false);

CREATE POLICY "Admins can manage account-documents"
  ON storage.objects FOR ALL
  USING (bucket_id = 'account-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can upload to account-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'account-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Clients can view own account-documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'account-documents' AND auth.uid() IS NOT NULL);

-- Trigger function to create notifications on key events
CREATE OR REPLACE FUNCTION public.create_notification_on_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account record;
  v_admin_ids uuid[];
BEGIN
  -- Get admin user IDs
  SELECT array_agg(user_id) INTO v_admin_ids FROM user_roles WHERE role = 'admin';

  IF TG_TABLE_NAME = 'messages' THEN
    SELECT * INTO v_account FROM accounts WHERE id = NEW.account_id;
    IF NEW.is_staff THEN
      -- Notify client
      IF v_account.client_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        VALUES (v_account.client_user_id, NEW.account_id, 'new_message',
          'New Message', 'You have a new message from your agent regarding ' || v_account.company_name);
      END IF;
    ELSE
      -- Notify all admins
      IF v_admin_ids IS NOT NULL THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        SELECT unnest(v_admin_ids), NEW.account_id, 'new_message',
          'New Client Message', 'New message from client on ' || v_account.company_name;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    SELECT * INTO v_account FROM accounts WHERE id = NEW.account_id;
    -- Notify client when quote status changes to info_requested or quoted
    IF v_account.client_user_id IS NOT NULL THEN
      IF NEW.status = 'info_requested' AND (OLD IS NULL OR OLD.status != 'info_requested') THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        VALUES (v_account.client_user_id, NEW.account_id, 'info_requested',
          'Action Required', 'A carrier has requested additional information for ' || v_account.company_name);
      ELSIF NEW.status = 'quoted' AND (OLD IS NULL OR OLD.status != 'quoted') THEN
        INSERT INTO notifications (user_id, account_id, type, title, message)
        VALUES (v_account.client_user_id, NEW.account_id, 'quote_ready',
          'Quote Available', 'A new quote is available for ' || v_account.company_name);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_on_event();

CREATE TRIGGER trg_notification_on_quote
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_on_event();
