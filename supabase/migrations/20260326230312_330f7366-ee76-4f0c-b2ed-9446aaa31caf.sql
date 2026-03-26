
-- Tasks / follow-up reminders table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid,
  assigned_to uuid,
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all tasks"
  ON public.tasks FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view tasks on own accounts"
  ON public.tasks FOR SELECT TO public
  USING (account_id IN (
    SELECT id FROM accounts WHERE client_user_id = auth.uid()
  ));

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
