begin;

create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('departments', 'profiles', 'department_leads', 'staff_invitations')
  ) then
    raise exception
      'Phase 1 base tables already exist. Stop and compare their exact schema before applying this migration.';
  end if;
end $$;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  role text not null,
  first_name text not null,
  middle_name text,
  surname text not null,
  department_id uuid references public.departments(id) on delete set null,
  role_title text not null,
  phone text,
  avatar_document_id uuid,
  is_active boolean not null default true,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_normalized_unique unique (email_normalized),
  constraint profiles_role_allowed
    check (role in ('super_admin', 'admin', 'lead', 'manager', 'intern'))
);

create table public.department_leads (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint department_leads_unique unique (department_id, profile_id)
);

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  invitation_number integer not null,
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  first_name text not null,
  middle_name text,
  surname text not null,
  phone text,
  department_id uuid not null references public.departments(id) on delete restrict,
  assigned_role text not null,
  role_title text not null,
  intended_start_date date,
  status text not null default 'selected',
  onboarding_token_hash text,
  onboarding_token_expires_at timestamptz,
  invitation_sent_at timestamptz,
  onboarding_started_at timestamptz,
  onboarding_submitted_at timestamptz,
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  activation_sent_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  replaces_invitation_id uuid references public.staff_invitations(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  revoked_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint staff_invitation_number_positive check (invitation_number > 0),
  constraint staff_invitation_role_allowed
    check (assigned_role in ('super_admin', 'admin', 'lead', 'manager', 'intern')),
  constraint staff_invitation_status_allowed
    check (status in (
      'selected', 'invitation_sent', 'onboarding_started',
      'onboarding_submitted', 'activation_pending',
      'active', 'revoked', 'expired'
    )),
  constraint staff_invitation_token_pair
    check (
      (onboarding_token_hash is null and onboarding_token_expires_at is null)
      or
      (onboarding_token_hash is not null and onboarding_token_expires_at is not null)
    )
);

create unique index staff_invitation_email_number_unique_idx
  on public.staff_invitations(email_normalized, invitation_number);

create unique index staff_invitation_active_email_unique_idx
  on public.staff_invitations(email_normalized)
  where status in (
    'selected', 'invitation_sent', 'onboarding_started',
    'onboarding_submitted', 'activation_pending', 'active'
  );

create unique index staff_invitation_token_hash_unique_idx
  on public.staff_invitations(onboarding_token_hash)
  where onboarding_token_hash is not null;

create index staff_invitation_token_expiry_idx
  on public.staff_invitations(onboarding_token_expires_at)
  where onboarding_token_hash is not null;

revoke all on public.departments, public.profiles, public.department_leads,
  public.staff_invitations from anon, authenticated;

revoke all on all sequences in schema public from anon, authenticated;

-- Application requirement: when creating or replacing an invitation, the
-- server must acquire pg_advisory_xact_lock(hashtextextended(normalized_email, 0))
-- inside the same transaction before checking, expiring/revoking, numbering,
-- or inserting invitations for that normalized email. This migration does not
-- execute the lock as a standalone statement.

commit;
