-- Ensure accepted client invitations always create the client role needed by the SPA router.
-- Also backfill any already-linked client accounts whose auth user is missing that role.

create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.client_invitations%rowtype;
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'You must be signed in to accept this invitation');
  end if;

  select *
  into v_invitation
  from public.client_invitations
  where token = p_token
  limit 1;

  if not found then
    return jsonb_build_object('error', 'Invalid invitation');
  end if;

  if v_invitation.expires_at < now() and v_invitation.status <> 'accepted' then
    update public.client_invitations
    set status = 'expired'
    where id = v_invitation.id;

    return jsonb_build_object('error', 'Invitation expired');
  end if;

  if v_email = '' or lower(v_invitation.email) <> v_email then
    return jsonb_build_object('error', 'This invitation is for a different email address');
  end if;

  update public.accounts
  set
    client_user_id = v_user_id,
    contact_email = coalesce(nullif(contact_email, ''), v_invitation.email),
    updated_at = now()
  where id = v_invitation.account_id;

  update public.client_invitations
  set status = 'accepted'
  where id = v_invitation.id;

  insert into public.profiles (user_id, email)
  select v_user_id, v_email
  where not exists (
    select 1 from public.profiles p where p.user_id = v_user_id
  );

  update public.profiles
  set email = coalesce(email, v_email)
  where user_id = v_user_id;

  insert into public.user_roles (user_id, role)
  select v_user_id, 'client'::public.app_role
  where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = 'client'::public.app_role
  );

  insert into public.activity_log (account_id, user_id, action_type, description)
  values (
    v_invitation.account_id,
    v_user_id,
    'client_invitation_accepted',
    'Client accepted invitation and was linked to account'
  );

  return jsonb_build_object('success', true, 'account_id', v_invitation.account_id);
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

insert into public.user_roles (user_id, role)
select distinct a.client_user_id, 'client'::public.app_role
from public.accounts a
where a.client_user_id is not null
  and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = a.client_user_id
      and ur.role = 'client'::public.app_role
  );
