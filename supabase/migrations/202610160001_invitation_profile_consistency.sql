begin;

-- Preserve the existing activation transaction, locks, grants, and audit behavior
-- while rejecting an existing profile whose identity or authorization details do
-- not match the stored invitation.
create or replace function public.activate_staff_invitation(p_token_hash text, p_auth_user_id uuid)
returns table (profile_id uuid, invitation_id uuid, already_complete boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_invitation public.staff_invitations;
  v_auth_email text;
  v_profile public.profiles;
  v_profile_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_auth_user_id is null then
    raise exception 'Invalid invitation';
  end if;

  select email into v_auth_email from auth.users where id = p_auth_user_id;
  if v_auth_email is null then
    raise exception 'Invalid invitation';
  end if;

  select * into v_invitation
  from public.staff_invitations
  where onboarding_token_hash = p_token_hash
  for update;
  if not found then
    raise exception 'Invalid invitation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_invitation.email_normalized, 0));

  select * into v_invitation
  from public.staff_invitations
  where id = v_invitation.id
  for update;

  if lower(btrim(v_auth_email)) <> v_invitation.email_normalized then
    raise exception 'Invitation email does not match this account';
  end if;

  if v_invitation.revoked_at is not null or v_invitation.status = 'revoked' then
    raise exception 'Invalid invitation';
  end if;

  select * into v_profile from public.profiles where auth_user_id = p_auth_user_id;

  if v_invitation.auth_user_id is not null then
    if v_invitation.auth_user_id = p_auth_user_id and v_profile.id is not null then
      if v_profile.email_normalized is distinct from v_invitation.email_normalized
         or v_profile.role is distinct from v_invitation.assigned_role
         or v_profile.department_id is distinct from v_invitation.department_id then
        raise exception 'Existing profile does not match invitation';
      end if;
      return query select v_profile.id, v_invitation.id, true;
      return;
    end if;
    raise exception 'This invitation has already been used';
  end if;

  if v_invitation.status not in ('selected', 'invitation_sent') then
    raise exception 'This invitation has already been used';
  end if;

  if v_invitation.onboarding_token_expires_at is null
     or v_invitation.onboarding_token_expires_at <= now() then
    raise exception 'Invalid invitation';
  end if;

  if exists (
    select 1 from public.profiles
    where email_normalized = v_invitation.email_normalized
      and auth_user_id is distinct from p_auth_user_id
  ) then
    raise exception 'An account already exists for this email';
  end if;

  if v_profile.id is not null then
    if v_profile.email_normalized is distinct from v_invitation.email_normalized
       or v_profile.role is distinct from v_invitation.assigned_role
       or v_profile.department_id is distinct from v_invitation.department_id then
      raise exception 'Existing profile does not match invitation';
    end if;
    v_profile_id := v_profile.id;
  else
    insert into public.profiles (
      auth_user_id, email, role, first_name, middle_name, surname,
      department_id, role_title, phone, is_active, activated_at
    ) values (
      p_auth_user_id,
      v_invitation.email,
      v_invitation.assigned_role,
      v_invitation.first_name,
      v_invitation.middle_name,
      v_invitation.surname,
      v_invitation.department_id,
      v_invitation.role_title,
      v_invitation.phone,
      true,
      now()
    )
    returning id into v_profile_id;

    if v_invitation.assigned_role in ('lead', 'manager') then
      insert into public.department_leads (department_id, profile_id)
      values (v_invitation.department_id, v_profile_id)
      on conflict (department_id, profile_id) do nothing;
    end if;
  end if;

  update public.staff_invitations
  set
    auth_user_id = p_auth_user_id,
    activated_at = now(),
    onboarding_started_at = coalesce(onboarding_started_at, now()),
    status = 'onboarding_started',
    updated_at = now()
  where id = v_invitation.id
    and auth_user_id is null;

  if not found then
    raise exception 'This invitation has already been used';
  end if;

  insert into public.audit_logs (actor_auth_user_id, actor_profile_id, action, target_type, target_id, metadata)
  values (
    p_auth_user_id,
    v_profile_id,
    'staff_invitation_activated',
    'staff_invitation',
    v_invitation.id,
    jsonb_build_object('role_source', 'invitation')
  );

  return query select v_profile_id, v_invitation.id, false;
end;
$$;

-- Preserve the original service-role-only execution boundary.
revoke all on function public.activate_staff_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.activate_staff_invitation(text, uuid) to service_role;
alter function public.activate_staff_invitation(text, uuid) owner to postgres;

commit;
