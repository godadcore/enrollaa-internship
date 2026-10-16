begin;

do $$
declare
  expected_tables text[] := array[
    'departments',
    'profiles',
    'department_leads',
    'staff_invitations',
    'agreement_versions',
    'onboarding_submissions',
    'onboarding_documents',
    'onboarding_bank_details'
  ];
  actual_count integer;
begin
  select count(*) into actual_count
  from pg_tables
  where schemaname = 'public'
    and tablename = any(expected_tables);

  if actual_count <> array_length(expected_tables, 1) then
    raise exception
      'Phase 1 schema is incomplete: expected all eight Phase 1 public tables before applying Storage/RLS settings.';
  end if;
end $$;

do $$
declare
  bucket record;
  expected_mime_types text[] := array[
    'application/msword',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];
  actual_mime_types text[];
begin
  select id, name, public, file_size_limit, allowed_mime_types
  into bucket
  from storage.buckets
  where id = 'staff-onboarding';

  if not found then
    insert into storage.buckets (
      id, name, public, file_size_limit, allowed_mime_types
    ) values (
      'staff-onboarding',
      'staff-onboarding',
      false,
      10485760,
      expected_mime_types
    );
  else
    select array_agg(mime_type order by mime_type)
    into actual_mime_types
    from unnest(bucket.allowed_mime_types) as mime_type;

    if bucket.id <> 'staff-onboarding'
       or bucket.name <> 'staff-onboarding'
       or bucket.public is distinct from false
       or bucket.file_size_limit is distinct from 10485760
       or actual_mime_types is distinct from expected_mime_types then
      raise exception
        'Existing staff-onboarding bucket configuration conflicts with required private settings.';
    end if;
  end if;
end $$;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.department_leads enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.agreement_versions enable row level security;
alter table public.onboarding_submissions enable row level security;
alter table public.onboarding_documents enable row level security;
alter table public.onboarding_bank_details enable row level security;

alter table public.departments force row level security;
alter table public.profiles force row level security;
alter table public.department_leads force row level security;
alter table public.staff_invitations force row level security;
alter table public.agreement_versions force row level security;
alter table public.onboarding_submissions force row level security;
alter table public.onboarding_documents force row level security;
alter table public.onboarding_bank_details force row level security;

-- Browser roles receive no direct table access. Privileged Supabase credentials
-- must remain server-side; RLS does not replace application-layer authorization.
revoke all on public.departments, public.profiles, public.department_leads,
  public.staff_invitations, public.agreement_versions,
  public.onboarding_submissions, public.onboarding_documents,
  public.onboarding_bank_details
from anon, authenticated;

-- staff-onboarding has no browser Storage policies. Server handlers validate
-- ownership, file signatures, scan state, and authorization before upload or
-- short-lived signed-download URL issuance.
revoke all on storage.objects, storage.buckets from anon, authenticated;

commit;
