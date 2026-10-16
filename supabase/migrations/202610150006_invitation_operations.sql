begin;

-- Controlled lookup values already used by the existing dashboard UI.
insert into public.departments (name, slug) values
  ('Product Research & Strategy', 'product-research-strategy'),
  ('AI / Monitoring / ML Engineering', 'ai-monitoring-ml-engineering'),
  ('Backend Engineering', 'backend-engineering'),
  ('Frontend Engineering', 'frontend-engineering'),
  ('UI/UX Design', 'ui-ux-design'),
  ('Content & Operations', 'content-operations')
on conflict (slug) do nothing;

create function public.create_staff_invitation(
  p_email text,
  p_first_name text,
  p_middle_name text,
  p_surname text,
  p_phone text,
  p_department_slug text,
  p_assigned_role text,
  p_role_title text,
  p_intended_start_date date,
  p_actor_profile_id uuid,
  p_token_hash text,
  p_token_expires_at timestamptz
)
returns table (invitation_id uuid, outbox_id uuid, department_name text, recipient_email text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_email text := lower(btrim(p_email));
  v_department public.departments;
  v_invitation_id uuid;
  v_outbox_id uuid;
  v_invitation_number integer;
  v_event_id uuid;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(btrim(p_first_name)) = 0 or length(btrim(p_surname)) = 0
     or length(btrim(p_role_title)) = 0 or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_token_expires_at <= now() then
    raise exception 'Invalid invitation input';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_actor_profile_id and is_active and role in ('admin', 'super_admin')
  ) then
    raise exception 'Administrator authorization is required';
  end if;

  select * into v_department from public.departments
  where slug = btrim(p_department_slug) and is_active
  for key share;
  if not found then raise exception 'The selected department is unavailable'; end if;

  -- Serializes creation/replacement for this normalized email in this transaction.
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  if exists (
    select 1 from public.staff_invitations
    where email_normalized = v_email
      and status in ('selected','invitation_sent','onboarding_started','onboarding_submitted','activation_pending','active')
  ) then
    raise exception 'An active invitation already exists for this email';
  end if;

  select coalesce(max(invitation_number), 0) + 1 into v_invitation_number
  from public.staff_invitations where email_normalized = v_email;

  insert into public.staff_invitations (
    invitation_number, email, first_name, middle_name, surname, phone,
    department_id, assigned_role, role_title, intended_start_date, status,
    onboarding_token_hash, onboarding_token_expires_at, created_by_profile_id
  ) values (
    v_invitation_number, v_email, btrim(p_first_name), nullif(btrim(p_middle_name), ''), btrim(p_surname), nullif(btrim(p_phone), ''),
    v_department.id, p_assigned_role, btrim(p_role_title), p_intended_start_date, 'selected',
    p_token_hash, p_token_expires_at, p_actor_profile_id
  ) returning id into v_invitation_id;

  v_event_id := (
    substr(md5(v_invitation_id::text || ':employment_invitation'), 1, 8) || '-' ||
    substr(md5(v_invitation_id::text || ':employment_invitation'), 9, 4) || '-' ||
    substr(md5(v_invitation_id::text || ':employment_invitation'), 13, 4) || '-' ||
    substr(md5(v_invitation_id::text || ':employment_invitation'), 17, 4) || '-' ||
    substr(md5(v_invitation_id::text || ':employment_invitation'), 21, 12)
  )::uuid;

  insert into public.email_outbox (stable_event_id, staff_invitation_id, template_type, resend_generation, recipient_email)
  values (v_event_id, v_invitation_id, 'employment_invitation', 0, v_email)
  returning id into v_outbox_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, metadata)
  values (p_actor_profile_id, 'staff_invitation_created', 'staff_invitation', v_invitation_id, jsonb_build_object('delivery', 'queued'));

  return query select v_invitation_id, v_outbox_id, v_department.name, v_email;
end;
$$;

create function public.resend_staff_invitation(
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
  if v_invitation.status in ('revoked','onboarding_started','onboarding_submitted','activation_pending','active') then
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

create function public.record_staff_invitation_delivery(
  p_outbox_id uuid,
  p_actor_profile_id uuid,
  p_accepted boolean,
  p_provider_message_id text,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_outbox public.email_outbox; v_attempt integer;
begin
  if not exists (select 1 from public.profiles where id = p_actor_profile_id and is_active and role in ('admin','super_admin')) then raise exception 'Administrator authorization is required'; end if;
  select * into v_outbox from public.email_outbox where id = p_outbox_id and template_type = 'employment_invitation' for update;
  if not found then raise exception 'Invitation email record not found'; end if;
  v_attempt := v_outbox.attempt_count + 1;
  insert into public.email_delivery_attempts (outbox_id, attempt_number, provider_message_id, completed_at, outcome, sanitized_error_code, sanitized_error_message)
  values (p_outbox_id, v_attempt, nullif(btrim(p_provider_message_id), ''), now(), case when p_accepted then 'accepted' else 'retryable_failure' end,
    nullif(left(btrim(coalesce(p_error_code,'')), 80), ''), nullif(left(btrim(coalesce(p_error_message,'')), 240), ''));
  update public.email_outbox set attempt_count = v_attempt,
    status = case when p_accepted then 'accepted' else 'retryable_failure' end,
    provider_message_id = case when p_accepted then nullif(btrim(p_provider_message_id), '') else null end,
    provider_accepted_at = case when p_accepted then now() else null end,
    failed_at = case when p_accepted then null else now() end,
    last_error_code = case when p_accepted then null else nullif(left(btrim(coalesce(p_error_code,'')),80),'') end,
    last_error_message = case when p_accepted then null else nullif(left(btrim(coalesce(p_error_message,'')),240),'') end,
    updated_at = now()
  where id = p_outbox_id;
  if p_accepted then
    update public.staff_invitations set status = 'invitation_sent', invitation_sent_at = now(), updated_at = now()
    where id = v_outbox.staff_invitation_id and status = 'selected';
  end if;
end;
$$;

create function public.revoke_staff_invitation(p_invitation_id uuid, p_actor_profile_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_invitation public.staff_invitations;
begin
  if length(btrim(coalesce(p_reason,''))) = 0 then raise exception 'A revocation reason is required'; end if;
  if not exists (select 1 from public.profiles where id = p_actor_profile_id and is_active and role in ('admin','super_admin')) then raise exception 'Administrator authorization is required'; end if;
  select * into v_invitation from public.staff_invitations where id = p_invitation_id for update;
  if not found then raise exception 'Invitation not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_invitation.email_normalized, 0));
  if v_invitation.status in ('onboarding_submitted','activation_pending','active','revoked') then raise exception 'This invitation cannot be revoked'; end if;
  update public.staff_invitations set status='revoked', revoked_at=now(), revoked_reason=left(btrim(p_reason),240), revoked_by_profile_id=p_actor_profile_id, updated_at=now() where id=p_invitation_id;
  update public.email_outbox set status='cancelled', updated_at=now() where staff_invitation_id=p_invitation_id and status in ('queued','retryable_failure','leased');
  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, metadata) values (p_actor_profile_id,'staff_invitation_revoked','staff_invitation',p_invitation_id,'{}'::jsonb);
end;
$$;

revoke all on function public.create_staff_invitation(text,text,text,text,text,text,text,text,date,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.resend_staff_invitation(uuid,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.record_staff_invitation_delivery(uuid,uuid,boolean,text,text,text) from public, anon, authenticated;
revoke all on function public.revoke_staff_invitation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.create_staff_invitation(text,text,text,text,text,text,text,text,date,uuid,text,timestamptz) to service_role;
grant execute on function public.resend_staff_invitation(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.record_staff_invitation_delivery(uuid,uuid,boolean,text,text,text) to service_role;
grant execute on function public.revoke_staff_invitation(uuid,uuid,text) to service_role;
alter function public.create_staff_invitation(text,text,text,text,text,text,text,text,date,uuid,text,timestamptz) owner to postgres;
alter function public.resend_staff_invitation(uuid,uuid,text,timestamptz) owner to postgres;
alter function public.record_staff_invitation_delivery(uuid,uuid,boolean,text,text,text) owner to postgres;
alter function public.revoke_staff_invitation(uuid,uuid,text) owner to postgres;

commit;
