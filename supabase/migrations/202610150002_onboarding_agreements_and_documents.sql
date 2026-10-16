begin;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'agreement_versions', 'onboarding_submissions',
        'onboarding_documents', 'onboarding_bank_details'
      )
  ) then
    raise exception
      'Phase 1 onboarding tables already exist. Stop and inspect before applying.';
  end if;
end $$;

create table public.agreement_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  title text not null,
  content text not null,
  content_sha256 text not null,
  published_at timestamptz,
  retired_at timestamptz,
  retired_by_profile_id uuid references public.profiles(id) on delete restrict,
  retirement_reason text,
  created_at timestamptz not null default now(),
  constraint agreement_hash_format check (content_sha256 ~ '^[a-f0-9]{64}$'),
  constraint agreement_retirement_lifecycle
    check (
      (retired_at is null and retired_by_profile_id is null and retirement_reason is null)
      or
      (
        published_at is not null
        and retired_at > published_at
        and retired_by_profile_id is not null
        and length(btrim(retirement_reason)) > 0
      )
    )
);

create table public.onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  staff_invitation_id uuid not null unique
    references public.staff_invitations(id) on delete restrict,
  idempotency_key uuid not null unique,
  first_name text not null,
  middle_name text,
  surname text not null,
  sex text check (sex in ('Male', 'Female', 'Prefer not to say')),
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  phone text not null,
  location_state text not null,
  location_city text not null,
  state_of_residence text,
  institution text,
  education_details jsonb not null default '{}'::jsonb,
  department_id uuid not null references public.departments(id) on delete restrict,
  role_title text not null,
  agreement_version_id uuid not null references public.agreement_versions(id) on delete restrict,
  agreement_content_sha256 text not null,
  agreement_accepted_at timestamptz not null,
  typed_signature text not null,
  status text not null default 'submitted',
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_status_allowed check (status in ('submitted', 'approved', 'rejected')),
  constraint onboarding_signature_present check (length(btrim(typed_signature)) >= 2),
  constraint onboarding_hash_format check (agreement_content_sha256 ~ '^[a-f0-9]{64}$')
);

create table public.onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  onboarding_submission_id uuid not null
    references public.onboarding_submissions(id) on delete restrict,
  kind text not null,
  storage_bucket text not null default 'staff-onboarding',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256_hex text not null,
  malware_scan_status text not null default 'pending',
  malware_scanned_at timestamptz,
  available_at timestamptz,
  unavailable_at timestamptz,
  unavailable_reason text,
  deleted_at timestamptz,
  uploaded_at timestamptz not null default now(),
  constraint document_kind_allowed
    check (kind in ('photo', 'cv', 'identity_document', 'other_required_document')),
  constraint document_size_positive check (byte_size > 0),
  constraint document_bucket_fixed check (storage_bucket = 'staff-onboarding'),
  constraint document_hash_format check (sha256_hex ~ '^[a-f0-9]{64}$'),
  constraint document_scan_status_allowed
    check (malware_scan_status in ('pending', 'clean', 'infected', 'failed'))
);

create unique index onboarding_active_photo_idx
  on public.onboarding_documents(onboarding_submission_id)
  where kind = 'photo' and deleted_at is null;

create unique index onboarding_active_cv_idx
  on public.onboarding_documents(onboarding_submission_id)
  where kind = 'cv' and deleted_at is null;

create table public.onboarding_bank_details (
  id uuid primary key default gen_random_uuid(),
  onboarding_submission_id uuid not null unique
    references public.onboarding_submissions(id) on delete restrict,
  ciphertext bytea not null,
  nonce bytea not null,
  authentication_tag bytea not null,
  encryption_key_version text not null,
  account_number_last4 char(4) not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  constraint bank_last4_format check (account_number_last4 ~ '^[0-9]{4}$'),
  constraint bank_encryption_material_present check (
    octet_length(ciphertext) > 0
    and octet_length(nonce) > 0
    and octet_length(authentication_tag) > 0
  )
);

alter table public.profiles
  add constraint profiles_avatar_document_fk
  foreign key (avatar_document_id)
  references public.onboarding_documents(id)
  on delete set null;

revoke all on public.agreement_versions, public.onboarding_submissions,
  public.onboarding_documents, public.onboarding_bank_details
from anon, authenticated;

commit;
