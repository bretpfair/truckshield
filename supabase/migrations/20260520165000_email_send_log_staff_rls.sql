-- Allow staff to inspect email delivery records while keeping account scoping intact.
-- Admins can read every row. Producers can only read rows tied to accounts assigned to them.

create or replace function public.email_send_log_account_id(p_metadata jsonb)
returns uuid
language sql
immutable
as $$
  select case
    when coalesce(p_metadata ->> 'account_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (p_metadata ->> 'account_id')::uuid
    else null
  end;
$$;

alter table public.email_send_log enable row level security;

drop policy if exists "Admins can read all email send logs" on public.email_send_log;
drop policy if exists "Producers can read assigned account email send logs" on public.email_send_log;

create policy "Admins can read all email send logs"
on public.email_send_log
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

create policy "Producers can read assigned account email send logs"
on public.email_send_log
for select
to authenticated
using (
  public.email_send_log_account_id(metadata) is not null
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'producer'
  )
  and exists (
    select 1
    from public.accounts a
    where a.id = public.email_send_log_account_id(email_send_log.metadata)
      and a.assigned_producer_id = auth.uid()
  )
);
