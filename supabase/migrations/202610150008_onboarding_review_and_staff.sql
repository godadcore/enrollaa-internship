begin;

alter table public.onboarding_submissions
  alter column phone drop not null,
  alter column location_state drop not null,
  alter column location_city drop not null,
  alter column agreement_version_id drop not null,
  alter column agreement_content_sha256 drop not null,
  alter column agreement_accepted_at drop not null,
  alter column typed_signature drop not null;

alter table public.onboarding_submissions
  drop constraint if exists onboarding_status_allowed,
  drop constraint if exists onboarding_signature_present,
  drop constraint if exists onboarding_hash_format;

alter table public.onboarding_submissions
  add constraint onboarding_status_allowed
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  add constraint onboarding_complete_when_submitted check (
    status = 'draft'
    or (
      phone is not null and length(btrim(phone)) > 0
      and location_state is not null and length(btrim(location_state)) > 0
      and location_city is not null and length(btrim(location_city)) > 0
      and agreement_version_id is not null
      and agreement_content_sha256 ~ '^[a-f0-9]{64}$'
      and agreement_accepted_at is not null
      and length(btrim(coalesce(typed_signature, ''))) >= 2
    )
  );

create or replace function private.validate_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  invitation public.staff_invitations;
  agreement public.agreement_versions;
begin
  select * into invitation
  from public.staff_invitations
  where id = new.staff_invitation_id
  for key share;

  if not found or invitation.revoked_at is not null then
    raise exception 'Invitation is not eligible for onboarding';
  end if;

  if invitation.auth_user_id is null then
    if invitation.status not in ('invitation_sent', 'onboarding_started')
       or invitation.onboarding_token_hash is null
       or invitation.onboarding_token_expires_at <= now() then
      raise exception 'Invitation is not eligible for onboarding';
    end if;
  elsif invitation.status not in ('onboarding_started', 'onboarding_submitted', 'activation_pending') then
    raise exception 'Invitation is not eligible for onboarding';
  end if;

  if new.email_normalized <> invitation.email_normalized
     or new.department_id <> invitation.department_id
     or new.role_title <> invitation.role_title then
    raise exception 'Submission differs from authoritative invitation';
  end if;

  if new.status <> 'draft' then
    select * into agreement
    from public.agreement_versions
    where id = new.agreement_version_id
      and published_at is not null
      and retired_at is null;
    if not found or agreement.content_sha256 <> new.agreement_content_sha256 then
      raise exception 'Agreement evidence is invalid';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.prevent_authoritative_submission_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.staff_invitation_id <> old.staff_invitation_id
     or new.email <> old.email
     or new.department_id <> old.department_id
     or new.role_title <> old.role_title then
    raise exception 'Authoritative submission fields are immutable';
  end if;

  if old.status in ('submitted', 'approved')
     and (
       new.agreement_version_id is distinct from old.agreement_version_id
       or new.agreement_content_sha256 is distinct from old.agreement_content_sha256
       or new.agreement_accepted_at is distinct from old.agreement_accepted_at
       or new.typed_signature is distinct from old.typed_signature
     ) then
    raise exception 'Authoritative submission fields are immutable';
  end if;

  if old.status = 'approved' and new.status is distinct from old.status then
    raise exception 'Approved onboarding cannot change status';
  end if;

  return new;
end;
$$;

insert into public.agreement_versions (version, title, content, content_sha256, published_at)
select
  'v1.0-2026',
  'Enrollaa Internship Terms, Confidentiality & Intellectual Property Agreement',
  $agreement$ENROLLAA INTERNSHIP TERMS, CONFIDENTIALITY & INTELLECTUAL PROPERTY AGREEMENT
Version: v1.0-2026 | Effective: October 19, 2026

1. Project Ownership: All deliverables, source code, designs, documentation, and product inventions created in connection with the Enrollaa Internship Program are governed by Enrollaa's written agreement and remain the proprietary assets of Enrollaa.
2. Contributor Integrity: Interns agree never to falsely claim the collective work of Enrollaa or another team contributor as their sole independent creation.
3. Portfolio & Professional Profiles: Interns may showcase approved projects and their genuine verified contributions in personal portfolios, resumes, and LinkedIn profiles, subject to confidentiality rules and prior authorization.
4. Non-Disclosure & Confidentiality: Internal platform logic, unreleased admission data signals, database configurations, business metrics, and personal user data must never be shared, copied, or published outside the platform.
5. Code of Conduct & Policies: Interns agree to maintain professional standards, punctuality, and respect across all operational workflows.$agreement$,
  encode(digest($agreement$ENROLLAA INTERNSHIP TERMS, CONFIDENTIALITY & INTELLECTUAL PROPERTY AGREEMENT
Version: v1.0-2026 | Effective: October 19, 2026

1. Project Ownership: All deliverables, source code, designs, documentation, and product inventions created in connection with the Enrollaa Internship Program are governed by Enrollaa's written agreement and remain the proprietary assets of Enrollaa.
2. Contributor Integrity: Interns agree never to falsely claim the collective work of Enrollaa or another team contributor as their sole independent creation.
3. Portfolio & Professional Profiles: Interns may showcase approved projects and their genuine verified contributions in personal portfolios, resumes, and LinkedIn profiles, subject to confidentiality rules and prior authorization.
4. Non-Disclosure & Confidentiality: Internal platform logic, unreleased admission data signals, database configurations, business metrics, and personal user data must never be shared, copied, or published outside the platform.
5. Code of Conduct & Policies: Interns agree to maintain professional standards, punctuality, and respect across all operational workflows.$agreement$, 'sha256'), 'hex'),
  now()
where not exists (select 1 from public.agreement_versions where version = 'v1.0-2026');

create or replace function public.save_onboarding_draft(
  p_actor_profile_id uuid,
  p_phone text,
  p_location_state text,
  p_location_city text,
  p_sex text,
  p_institution text,
  p_state_of_residence text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_invitation public.staff_invitations;
  v_submission_id uuid;
begin
  select * into v_profile from public.profiles where id = p_actor_profile_id and is_active;
  if not found or v_profile.role <> 'intern' then
    raise exception 'Intern authorization is required';
  end if;

  select * into v_invitation
  from public.staff_invitations
  where auth_user_id = v_profile.auth_user_id
  for update;
  if not found then raise exception 'No activated invitation is available for onboarding'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_invitation.email_normalized, 0));

  select id into v_submission_id from public.onboarding_submissions where staff_invitation_id = v_invitation.id;
  if v_submission_id is not null then
    if exists (select 1 from public.onboarding_submissions where id = v_submission_id and status not in ('draft', 'rejected')) then
      raise exception 'This onboarding record cannot be edited';
    end if;
    update public.onboarding_submissions set
      phone = nullif(btrim(p_phone), ''),
      location_state = nullif(btrim(p_location_state), ''),
      location_city = nullif(btrim(p_location_city), ''),
      sex = case when p_sex in ('Male','Female','Prefer not to say') then p_sex else sex end,
      institution = nullif(btrim(p_institution), ''),
      state_of_residence = nullif(btrim(p_state_of_residence), ''),
      status = case when status = 'rejected' then 'rejected' else 'draft' end,
      updated_at = now()
    where id = v_submission_id;
    return v_submission_id;
  end if;

  insert into public.onboarding_submissions (
    staff_invitation_id, idempotency_key, first_name, middle_name, surname, sex, email, phone,
    location_state, location_city, state_of_residence, institution, department_id, role_title, status
  ) values (
    v_invitation.id, gen_random_uuid(), v_invitation.first_name, v_invitation.middle_name, v_invitation.surname,
    case when p_sex in ('Male','Female','Prefer not to say') then p_sex else null end,
    v_invitation.email, nullif(btrim(p_phone), ''), nullif(btrim(p_location_state), ''),
    nullif(btrim(p_location_city), ''), nullif(btrim(p_state_of_residence), ''), nullif(btrim(p_institution), ''),
    v_invitation.department_id, v_invitation.role_title, 'draft'
  ) returning id into v_submission_id;

  return v_submission_id;
end;
$$;

create or replace function public.submit_onboarding(
  p_actor_profile_id uuid,
  p_typed_signature text,
  p_agreement_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_invitation public.staff_invitations;
  v_submission public.onboarding_submissions;
  v_agreement public.agreement_versions;
begin
  select * into v_profile from public.profiles where id = p_actor_profile_id and is_active;
  if not found or v_profile.role <> 'intern' then raise exception 'Intern authorization is required'; end if;

  select * into v_invitation from public.staff_invitations where auth_user_id = v_profile.auth_user_id for update;
  if not found then raise exception 'No activated invitation is available for onboarding'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_invitation.email_normalized, 0));

  select * into v_submission from public.onboarding_submissions where staff_invitation_id = v_invitation.id for update;
  if not found then raise exception 'Save a draft before submitting onboarding'; end if;
  if v_submission.status not in ('draft', 'rejected') then raise exception 'This onboarding record cannot be submitted'; end if;

  select * into v_agreement from public.agreement_versions
  where id = p_agreement_version_id and published_at is not null and retired_at is null;
  if not found then raise exception 'Agreement evidence is invalid'; end if;
  if length(btrim(coalesce(p_typed_signature, ''))) < 2 then raise exception 'A typed signature is required'; end if;

  if not exists (
    select 1 from public.onboarding_documents
    where onboarding_submission_id = v_submission.id and kind = 'photo' and deleted_at is null
  ) or not exists (
    select 1 from public.onboarding_documents
    where onboarding_submission_id = v_submission.id and kind = 'cv' and deleted_at is null
  ) then
    raise exception 'A photograph and CV are required before submission';
  end if;

  update public.onboarding_submissions set
    agreement_version_id = v_agreement.id,
    agreement_content_sha256 = v_agreement.content_sha256,
    agreement_accepted_at = now(),
    typed_signature = btrim(p_typed_signature),
    status = 'submitted',
    reviewed_at = null,
    reviewed_by_profile_id = null,
    review_note = null,
    updated_at = now()
  where id = v_submission.id;

  update public.staff_invitations set
    status = 'onboarding_submitted',
    onboarding_submitted_at = now(),
    updated_at = now()
  where id = v_invitation.id;

  insert into public.audit_logs (actor_auth_user_id, actor_profile_id, action, target_type, target_id, metadata)
  values (v_profile.auth_user_id, v_profile.id, 'onboarding_submitted', 'onboarding_submission', v_submission.id, '{}'::jsonb);

  return v_submission.id;
end;
$$;

create or replace function public.review_onboarding(
  p_actor_profile_id uuid,
  p_submission_id uuid,
  p_decision text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_submission public.onboarding_submissions;
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'Review decision is invalid'; end if;
  select * into v_profile from public.profiles where id = p_actor_profile_id and is_active;
  if not found then raise exception 'Authorization is required'; end if;
  if v_profile.role not in ('admin', 'super_admin', 'lead', 'manager') then
    raise exception 'You do not have access to this resource';
  end if;

  select * into v_submission from public.onboarding_submissions where id = p_submission_id for update;
  if not found then raise exception 'Onboarding submission not found'; end if;
  if v_submission.status <> 'submitted' then raise exception 'Only submitted onboarding can be reviewed'; end if;

  if v_profile.role in ('lead', 'manager') and v_profile.department_id is distinct from v_submission.department_id then
    raise exception 'You do not have access to this department';
  end if;

  if p_decision = 'rejected' and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'A review note is required when requesting corrections';
  end if;

  update public.onboarding_submissions set
    status = p_decision,
    reviewed_at = now(),
    reviewed_by_profile_id = v_profile.id,
    review_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''),
    updated_at = now()
  where id = v_submission.id;

  if p_decision = 'approved' then
    update public.staff_invitations set status = 'active', updated_at = now()
    where id = v_submission.staff_invitation_id;
  end if;

  insert into public.audit_logs (actor_auth_user_id, actor_profile_id, action, target_type, target_id, metadata)
  values (
    v_profile.auth_user_id, v_profile.id,
    case when p_decision = 'approved' then 'onboarding_approved' else 'onboarding_corrections_requested' end,
    'onboarding_submission', v_submission.id, jsonb_build_object('decision', p_decision)
  );
end;
$$;

revoke all on function public.save_onboarding_draft(uuid,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.submit_onboarding(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.review_onboarding(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.save_onboarding_draft(uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.submit_onboarding(uuid,text,uuid) to service_role;
grant execute on function public.review_onboarding(uuid,uuid,text,text) to service_role;
alter function public.save_onboarding_draft(uuid,text,text,text,text,text,text) owner to postgres;
alter function public.submit_onboarding(uuid,text,uuid) owner to postgres;
alter function public.review_onboarding(uuid,uuid,text,text) owner to postgres;

commit;
