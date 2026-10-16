begin;

create function public.lookup_auth_user_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, auth, public, pg_temp
as $$
  select id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;
$$;

create function public.activate_staff_invitation(p_token_hash text, p_auth_user_id uuid)
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

create or replace function public.resend_staff_invitation(
  p_invitation_id uuid,
  p_actor_profile_id uuid,
  p_token_hash text,
  p_token_expires_at timestamptz
)
returns table (outbox_id uuid, department_name text, recipient_email text, first_name text, surname text, role_title text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_invitation public.staff_invitations;
  v_department_name text;
  v_outbox_id uuid;
  v_generation integer;
  v_event_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_token_expires_at <= now() then raise exception 'Invalid invitation token input'; end if;
  if not exists (select 1 from public.profiles where id = p_actor_profile_id and is_active and role in ('admin','super_admin')) then
    raise exception 'Administrator authorization is required';
  end if;
  select * into v_invitation from public.staff_invitations where id = p_invitation_id for update;
  if not found then raise exception 'Invitation not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_invitation.email_normalized, 0));
  if v_invitation.auth_user_id is not null or v_invitation.activated_at is not null
     or v_invitation.status in ('revoked','onboarding_started','onboarding_submitted','activation_pending','active') then
    raise exception 'This invitation cannot be resent';
  end if;
  select name into v_department_name from public.departments where id = v_invitation.department_id;
  if v_department_name is null then raise exception 'Invitation department is unavailable'; end if;

  update public.staff_invitations set status = 'selected', onboarding_token_hash = p_token_hash,
    onboarding_token_expires_at = p_token_expires_at, invitation_sent_at = null, updated_at = now()
  where id = p_invitation_id;

  v_event_id := (
    substr(md5(p_invitation_id::text || ':employment_invitation'), 1, 8) || '-' ||
    substr(md5(p_invitation_id::text || ':employment_invitation'), 9, 4) || '-' ||
    substr(md5(p_invitation_id::text || ':employment_invitation'), 13, 4) || '-' ||
    substr(md5(p_invitation_id::text || ':employment_invitation'), 17, 4) || '-' ||
    substr(md5(p_invitation_id::text || ':employment_invitation'), 21, 12)
  )::uuid;
  select coalesce(max(resend_generation), -1) + 1 into v_generation
  from public.email_outbox where staff_invitation_id = p_invitation_id and template_type = 'employment_invitation';
  insert into public.email_outbox (stable_event_id, staff_invitation_id, template_type, resend_generation, recipient_email)
  values (v_event_id, p_invitation_id, 'employment_invitation', v_generation, v_invitation.email)
  returning id into v_outbox_id;
  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, metadata)
  values (p_actor_profile_id, 'staff_invitation_resent', 'staff_invitation', p_invitation_id, jsonb_build_object('generation', v_generation));
  return query select v_outbox_id, v_department_name, v_invitation.email, v_invitation.first_name, v_invitation.surname, v_invitation.role_title;
end;
$$;

create or replace function public.revoke_staff_invitation(p_invitation_id uuid, p_actor_profile_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_invitation public.staff_invitations;
begin
  if length(btrim(coalesce(p_reason,''))) = 0 then raise exception 'A revocation reason is required'; end if;
  if not exists (select 1 from public.profiles where id = p_actor_profile_id and is_active and role in ('admin','super_admin')) then raise exception 'Administrator authorization is required'; end if;
  select * into v_invitation from public.staff_invitations where id = p_invitation_id for update;
  if not found then raise exception 'Invitation not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_invitation.email_normalized, 0));
  if v_invitation.auth_user_id is not null or v_invitation.activated_at is not null
     or v_invitation.status in ('onboarding_submitted','activation_pending','active','revoked') then
    raise exception 'This invitation cannot be revoked';
  end if;
  update public.staff_invitations set status='revoked', revoked_at=now(), revoked_reason=left(btrim(p_reason),240), revoked_by_profile_id=p_actor_profile_id, updated_at=now() where id=p_invitation_id;
  update public.email_outbox set status='cancelled', updated_at=now() where staff_invitation_id=p_invitation_id and status in ('queued','retryable_failure','leased');
  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, metadata) values (p_actor_profile_id,'staff_invitation_revoked','staff_invitation',p_invitation_id,'{}'::jsonb);
end;
$$;

revoke all on function public.lookup_auth_user_id(text) from public, anon, authenticated;
revoke all on function public.activate_staff_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.lookup_auth_user_id(text) to service_role;
grant execute on function public.activate_staff_invitation(text, uuid) to service_role;
alter function public.lookup_auth_user_id(text) owner to postgres;
alter function public.activate_staff_invitation(text, uuid) owner to postgres;
alter function public.resend_staff_invitation(uuid,uuid,text,timestamptz) owner to postgres;
alter function public.revoke_staff_invitation(uuid,uuid,text) owner to postgres;

commit;
