-- Prepared only. Do not apply until the link workflow, provider allow-list,
-- and hosted migration plan have been reviewed and approved.
begin;

create table public.onboarding_document_links (
  id uuid primary key default gen_random_uuid(),
  onboarding_submission_id uuid not null references public.onboarding_submissions(id) on delete restrict,
  kind text not null,
  provider text not null,
  url text not null,
  scan_status text not null default 'unscanned',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint document_link_kind_allowed check (kind in ('cv', 'identity_document', 'other_required_document')),
  constraint document_link_provider_allowed check (provider in ('google_drive', 'dropbox', 'onedrive')),
  constraint document_link_https_only check (url ~ '^https://'),
  constraint document_link_scan_status_allowed check (scan_status in ('unscanned', 'unavailable'))
);

create unique index onboarding_active_document_link_idx
  on public.onboarding_document_links(onboarding_submission_id, kind)
  where deleted_at is null;

alter table public.onboarding_document_links enable row level security;
alter table public.onboarding_document_links force row level security;
revoke all on public.onboarding_document_links from anon, authenticated;

commit;
