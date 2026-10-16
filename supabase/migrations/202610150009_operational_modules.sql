begin;

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  intern_profile_id uuid not null references public.profiles(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  attendance_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  status text not null,
  punctuality_score integer not null default 0,
  correction_reason text,
  corrected_by_profile_id uuid references public.profiles(id) on delete set null,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_status_allowed check (status in ('on_time', 'late', 'excused', 'absent')),
  constraint attendance_score_range check (punctuality_score between 0 and 100),
  constraint attendance_unique_day unique (intern_profile_id, attendance_date),
  constraint attendance_checkout_after_checkin check (
    check_out_at is null or (check_in_at is not null and check_out_at >= check_in_at)
  )
);

create index attendance_department_date_idx on public.attendance_records (department_id, attendance_date desc);
create index attendance_intern_date_idx on public.attendance_records (intern_profile_id, attendance_date desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  instructions text,
  acceptance_criteria text,
  submission_requirements text,
  department_id uuid not null references public.departments(id) on delete restrict,
  assigned_to_profile_id uuid references public.profiles(id) on delete restrict,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  priority text not null default 'medium',
  status text not null default 'assigned',
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_title_present check (length(btrim(title)) >= 3),
  constraint task_priority_allowed check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint task_status_allowed check (status in (
    'assigned', 'in_progress', 'submitted', 'revision_requested', 'approved', 'rejected', 'cancelled'
  ))
);

create index tasks_department_idx on public.tasks (department_id, created_at desc);
create index tasks_assignee_idx on public.tasks (assigned_to_profile_id, status);

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  intern_profile_id uuid not null references public.profiles(id) on delete restrict,
  deliverable_url text not null,
  notes text,
  submitted_at timestamptz not null default now(),
  review_status text not null default 'pending',
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  review_feedback text,
  reviewed_at timestamptz,
  constraint task_submission_unique unique (task_id, intern_profile_id),
  constraint task_review_status_allowed check (review_status in ('pending', 'revision_requested', 'approved', 'rejected')),
  constraint task_deliverable_present check (length(btrim(deliverable_url)) >= 8)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  message text not null,
  created_at timestamptz not null default now(),
  constraint task_comment_present check (length(btrim(message)) >= 1)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  audience_type text not null,
  audience_role text,
  audience_department_id uuid references public.departments(id) on delete restrict,
  status text not null default 'published',
  is_dismissible boolean not null default true,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcement_title_present check (length(btrim(title)) >= 3),
  constraint announcement_content_present check (length(btrim(content)) >= 3),
  constraint announcement_audience_allowed check (audience_type in ('all', 'role', 'department')),
  constraint announcement_status_allowed check (status in ('draft', 'published', 'archived')),
  constraint announcement_role_required check (
    (audience_type <> 'role' and audience_role is null)
    or (audience_type = 'role' and audience_role in ('intern', 'lead', 'manager', 'admin', 'super_admin'))
  ),
  constraint announcement_department_required check (
    (audience_type <> 'department' and audience_department_id is null)
    or (audience_type = 'department' and audience_department_id is not null)
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null,
  link text,
  read_at timestamptz,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  constraint notification_type_allowed check (
    notification_type in ('system', 'task', 'attendance', 'giveaway', 'announcement', 'report', 'onboarding')
  )
);

create unique index notifications_source_unique
  on public.notifications (recipient_profile_id, source_type, source_id)
  where source_type is not null and source_id is not null;

create index notifications_recipient_idx on public.notifications (recipient_profile_id, created_at desc);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  lead_profile_id uuid not null references public.profiles(id) on delete restrict,
  week_number integer not null default 1,
  period_start date not null,
  period_end date not null,
  attendance_summary text,
  tasks_completed_summary text,
  tasks_in_progress_summary text,
  blockers_and_risks text,
  resource_requests text,
  admin_feedback text,
  status text not null default 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_report_week_positive check (week_number >= 1),
  constraint weekly_report_period check (period_end >= period_start),
  constraint weekly_report_status_allowed check (status in ('draft', 'submitted', 'changes_requested', 'reviewed')),
  constraint weekly_report_unique unique (department_id, week_number)
);

create table public.giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  scheduled_at timestamptz not null,
  scoring_period_start timestamptz not null,
  scoring_period_end timestamptz not null,
  prize_1st integer not null,
  prize_2nd integer not null,
  punctuality_weight integer not null default 50,
  task_weight integer not null default 50,
  minimum_attendance_rate integer not null default 0,
  minimum_approved_tasks integer not null default 0,
  status text not null default 'scheduled',
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint giveaway_title_present check (length(btrim(title)) >= 3),
  constraint giveaway_prizes_positive check (prize_1st >= 0 and prize_2nd >= 0),
  constraint giveaway_weights check (punctuality_weight + task_weight = 100),
  constraint giveaway_period check (scoring_period_end >= scoring_period_start),
  constraint giveaway_status_allowed check (status in ('draft', 'scheduled', 'running', 'completed', 'cancelled'))
);

create table public.giveaway_winners (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete restrict,
  intern_profile_id uuid not null references public.profiles(id) on delete restrict,
  rank integer not null,
  prize_amount integer not null,
  final_score numeric(6,1) not null,
  payment_status text not null default 'pending',
  payment_reference text,
  paid_at timestamptz,
  paid_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint giveaway_winner_rank check (rank in (1, 2)),
  constraint giveaway_winner_unique_rank unique (giveaway_id, rank),
  constraint giveaway_winner_unique_intern unique (giveaway_id, intern_profile_id),
  constraint giveaway_payment_status_allowed check (payment_status in ('pending', 'processing', 'paid', 'failed'))
);

alter table public.attendance_records enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.task_comments enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.giveaways enable row level security;
alter table public.giveaway_winners enable row level security;

alter table public.attendance_records force row level security;
alter table public.tasks force row level security;
alter table public.task_submissions force row level security;
alter table public.task_comments force row level security;
alter table public.announcements force row level security;
alter table public.notifications force row level security;
alter table public.weekly_reports force row level security;
alter table public.giveaways force row level security;
alter table public.giveaway_winners force row level security;

revoke all on
  public.attendance_records,
  public.tasks,
  public.task_submissions,
  public.task_comments,
  public.announcements,
  public.notifications,
  public.weekly_reports,
  public.giveaways,
  public.giveaway_winners
from anon, authenticated;

commit;
