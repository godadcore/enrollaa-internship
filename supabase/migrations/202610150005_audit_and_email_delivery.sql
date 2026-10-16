begin;

do $$
declare
  required_count integer;
  target_count integer;
begin
  select count(*) into required_count
  from pg_tables
  where schemaname = 'public'
    and tablename in ('staff_invitations', 'onboarding_submissions');

  if required_count <> 2 then
    raise exception
      'Phase 1 schema is incomplete: staff_invitations and onboarding_submissions must exist before email/audit migration.';
  end if;

  select count(*) into target_count
  from pg_tables
  where schemaname = 'public'
    and tablename in ('email_outbox', 'email_delivery_attempts', 'audit_logs');

  if target_count <> 0 then
    raise exception
      'Email/audit tables already exist. Stop and inspect before applying this migration.';
  end if;
end $$;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  stable_event_id uuid not null,
  staff_invitation_id uuid references public.staff_invitations(id) on delete set null,
  onboarding_submission_id uuid references public.onboarding_submissions(id) on delete set null,
  template_type text not null,
  resend_generation integer not null default 0,
  recipient_email text not null,
  recipient_email_normalized text generated always as (lower(btrim(recipient_email))) stored,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  provider_message_id text,
  provider_accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint email_template_allowed
    check (template_type in (
      'employment_invitation',
      'staff_activation',
      'admin_onboarding_submitted'
    )),
  constraint email_status_allowed
    check (status in (
      'queued', 'leased', 'accepted', 'delivered',
      'retryable_failure', 'permanent_failure', 'cancelled'
    )),
  constraint email_generation_nonnegative check (resend_generation >= 0),
  constraint email_attempt_count_nonnegative check (attempt_count >= 0),
  constraint email_event_generation_unique
    unique (stable_event_id, template_type, resend_generation)
);

create index email_outbox_claim_idx
  on public.email_outbox(next_attempt_at)
  where status in ('queued', 'retryable_failure');

create table public.email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.email_outbox(id) on delete restrict,
  attempt_number integer not null,
  provider text not null default 'resend',
  provider_message_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  outcome text not null default 'started',
  sanitized_error_code text,
  sanitized_error_message text,

  constraint email_attempt_number_positive check (attempt_number > 0),
  constraint email_attempt_outcome_allowed
    check (outcome in ('started', 'accepted', 'retryable_failure', 'permanent_failure')),
  constraint email_attempt_unique unique (outbox_id, attempt_number)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  request_id uuid,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

alter table public.email_outbox enable row level security;
alter table public.email_delivery_attempts enable row level security;
alter table public.audit_logs enable row level security;

alter table public.email_outbox force row level security;
alter table public.email_delivery_attempts force row level security;
alter table public.audit_logs force row level security;

revoke all on public.email_outbox, public.email_delivery_attempts,
  public.audit_logs from anon, authenticated;

-- Initial staff activation uses a deterministic server-generated stable_event_id
-- derived from staff_invitation_id and the staff_activation event type. Initial
-- Admin notification uses one derived from onboarding_submission_id and the
-- admin_onboarding_submitted event type. Accidental retries reuse the same event
-- ID and generation. Intentional resend requires server-side authorization, audit
-- logging, and a controlled resend_generation increment.
--
-- hello@enrollaa.com.ng is the fixed Admin recipient in server-side code only;
-- browser input must never provide or override it. Provider credentials remain
-- server-side. Email content and logs must not include bank details, CVs, identity
-- documents, passwords, activation tokens, or signed URLs.
--
-- Worker design: claim eligible rows in an application transaction with SELECT
-- ... FOR UPDATE SKIP LOCKED, assign a short lease, increment attempt_count, and
-- write an email_delivery_attempt. Reconcile timeouts through provider/webhook
-- status before retrying; no exactly-once delivery guarantee is implied.

commit;
