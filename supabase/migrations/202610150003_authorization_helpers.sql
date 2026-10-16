begin;

do $$
begin
  if to_regprocedure('private.is_department_lead(uuid)') is not null
     or to_regprocedure('private.validate_submission()') is not null
     or to_regprocedure('private.prevent_authoritative_submission_change()') is not null
     or to_regprocedure('private.prevent_published_agreement_update()') is not null
     or to_regprocedure('private.prevent_published_agreement_delete()') is not null
     or to_regprocedure('public.lead_onboarding_directory()') is not null
     or exists (
       select 1 from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where not t.tgisinternal
         and n.nspname = 'public'
         and t.tgname in (
           'onboarding_submission_insert_validation',
           'onboarding_submission_authoritative_fields_immutable',
           'agreement_published_update_protection',
           'agreement_published_delete_protection'
         )
     ) then
    raise exception 'Authorization helper functions or triggers already exist. Stop and inspect before applying.';
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.is_department_lead(target_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.department_leads dl
    join public.profiles p on p.id = dl.profile_id
    where dl.department_id = target_department_id
      and p.auth_user_id = auth.uid()
      and p.is_active
      and p.role in ('lead', 'manager')
  );
$$;

create function private.validate_submission()
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

  if not found
     or invitation.status not in ('invitation_sent', 'onboarding_started')
     or invitation.revoked_at is not null
     or invitation.onboarding_token_hash is null
     or invitation.onboarding_token_expires_at <= now() then
    raise exception 'Invitation is not eligible for onboarding';
  end if;

  if new.email_normalized <> invitation.email_normalized
     or new.department_id <> invitation.department_id
     or new.role_title <> invitation.role_title then
    raise exception 'Submission differs from authoritative invitation';
  end if;

  select * into agreement
  from public.agreement_versions
  where id = new.agreement_version_id
    and published_at is not null
    and retired_at is null;

  if not found or agreement.content_sha256 <> new.agreement_content_sha256 then
    raise exception 'Agreement evidence is invalid';
  end if;

  return new;
end;
$$;

create function private.prevent_authoritative_submission_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.staff_invitation_id <> old.staff_invitation_id
     or new.email <> old.email
     or new.department_id <> old.department_id
     or new.role_title <> old.role_title
     or new.agreement_version_id <> old.agreement_version_id
     or new.agreement_content_sha256 <> old.agreement_content_sha256
     or new.agreement_accepted_at <> old.agreement_accepted_at
     or new.typed_signature <> old.typed_signature then
    raise exception 'Authoritative submission fields are immutable';
  end if;
  return new;
end;
$$;

create trigger onboarding_submission_insert_validation
before insert on public.onboarding_submissions
for each row execute function private.validate_submission();

create trigger onboarding_submission_authoritative_fields_immutable
before update on public.onboarding_submissions
for each row execute function private.prevent_authoritative_submission_change();

create function private.prevent_published_agreement_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if old.published_at is not null and (
    new.version <> old.version
    or new.title <> old.title
    or new.content <> old.content
    or new.content_sha256 <> old.content_sha256
    or new.published_at <> old.published_at
  ) then
    raise exception 'Published agreement content and publication evidence are immutable';
  end if;

  if old.retired_at is not null and (
    new.retired_at is distinct from old.retired_at
    or new.retired_by_profile_id is distinct from old.retired_by_profile_id
    or new.retirement_reason is distinct from old.retirement_reason
  ) then
    raise exception 'Agreement retirement evidence is immutable';
  end if;

  if old.retired_at is null and new.retired_at is null and (
    new.retired_by_profile_id is not null
    or new.retirement_reason is not null
  ) then
    raise exception 'Retirement evidence may only be recorded during retirement';
  end if;

  if old.retired_at is null and new.retired_at is not null and (
    old.published_at is null
    or new.retired_by_profile_id is null
    or length(btrim(coalesce(new.retirement_reason, ''))) = 0
  ) then
    raise exception 'Retirement requires a published agreement, actor, timestamp, and reason';
  end if;

  return new;
end;
$$;

create function private.prevent_published_agreement_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if old.published_at is not null then
    raise exception 'Published agreements cannot be deleted';
  end if;
  return old;
end;
$$;

create trigger agreement_published_update_protection
before update on public.agreement_versions
for each row execute function private.prevent_published_agreement_update();

create trigger agreement_published_delete_protection
before delete on public.agreement_versions
for each row execute function private.prevent_published_agreement_delete();

create function public.lead_onboarding_directory()
returns table (
  onboarding_submission_id uuid,
  staff_invitation_id uuid,
  department_id uuid,
  first_name text,
  surname text,
  role_title text,
  submission_status text,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private, pg_temp
as $$
  select s.id, i.id, i.department_id, s.first_name, s.surname,
         i.role_title, s.status, s.created_at
  from public.onboarding_submissions s
  join public.staff_invitations i on i.id = s.staff_invitation_id
  where private.is_department_lead(i.department_id);
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.lead_onboarding_directory() from public, anon;
grant execute on function public.lead_onboarding_directory() to authenticated;

alter function private.is_department_lead(uuid) owner to postgres;
alter function private.validate_submission() owner to postgres;
alter function private.prevent_authoritative_submission_change() owner to postgres;
alter function private.prevent_published_agreement_update() owner to postgres;
alter function private.prevent_published_agreement_delete() owner to postgres;
alter function public.lead_onboarding_directory() owner to postgres;

commit;
