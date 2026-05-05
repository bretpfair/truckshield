create or replace function public.send_invite_on_producer_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  -- Only fire on the FIRST assignment (null -> non-null)
  if old.assigned_producer_id is not null then
    return new;
  end if;
  if new.assigned_producer_id is null then
    return new;
  end if;

  -- Skip if no contact email or client already linked
  if new.contact_email is null or trim(new.contact_email) = '' then
    return new;
  end if;
  if new.client_user_id is not null then
    return new;
  end if;

  -- Skip if an invitation already exists (manual invite already sent, or legacy)
  if exists (select 1 from client_invitations where account_id = new.id) then
    return new;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;

  if v_url is not null and v_key is not null then
    perform net.http_post(
      url := v_url || '/functions/v1/send-portal-invite-on-assignment',
      body := jsonb_build_object('account_id', new.id::text),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_send_invite_on_producer_assignment on public.accounts;

create trigger trg_send_invite_on_producer_assignment
after update of assigned_producer_id on public.accounts
for each row
execute function public.send_invite_on_producer_assignment();