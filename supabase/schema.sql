-- ============================================================================
-- ENROLLAA INTERNSHIP MANAGEMENT SYSTEM
-- Complete PostgreSQL / Supabase Relational Schema
-- Version: 1.0.0 (Production Release)
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'manager', 'intern');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE candidate_status AS ENUM (
    'selected', 'invitation_sent', 'registration_started', 'submitted', 'approved', 'account_activated', 'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'assigned', 'in_progress', 'submitted', 'revision_requested', 'approved', 'rejected', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('on_time', 'late', 'excused', 'absent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE giveaway_status AS ENUM ('draft', 'scheduled', 'running', 'completed', 'cancelled', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'paid', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. DEPARTMENTS & MANAGERS
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. USER PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE, -- References auth.users(id) in Supabase
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'intern' NOT NULL,
  first_name TEXT NOT NULL,
  surname TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  role_title TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.department_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  manager_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(department_id, manager_profile_id)
);

-- 5. CANDIDATES & INVITATIONS
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  sex TEXT CHECK (sex IN ('Male', 'Female')),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  location_state TEXT,
  location_city TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE RESTRICT NOT NULL,
  role_title TEXT NOT NULL,
  intended_start_date DATE DEFAULT '2026-10-19' NOT NULL,
  status candidate_status DEFAULT 'selected' NOT NULL,
  slack_invited BOOLEAN DEFAULT false NOT NULL,
  slack_joined BOOLEAN DEFAULT false NOT NULL,
  invitation_token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  invitation_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. ONBOARDING SUBMISSIONS & AGREEMENT VERSIONS
CREATE TABLE IF NOT EXISTS public.agreement_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  effective_date DATE DEFAULT '2026-10-19' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.onboarding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  location_state TEXT NOT NULL,
  location_city TEXT NOT NULL,
  photo_storage_path TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE RESTRICT NOT NULL,
  role_title TEXT NOT NULL,
  -- Sensitive bank information (restricted to super_admin)
  bank_name TEXT,
  account_name TEXT,
  account_number_encrypted TEXT,
  account_number_last4 VARCHAR(4),
  -- Intellectual property & electronic consent record
  agreement_version_id UUID REFERENCES public.agreement_versions(id) NOT NULL,
  ip_agreement_accepted BOOLEAN DEFAULT false NOT NULL,
  typed_signature TEXT NOT NULL,
  client_ip TEXT,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 7. ATTENDANCE SYSTEM
CREATE TABLE IF NOT EXISTS public.attendance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_target_time_wat TIME DEFAULT '09:00:00' NOT NULL,
  grace_period_minutes INT DEFAULT 15 NOT NULL,
  late_cutoff_time_wat TIME DEFAULT '10:30:00' NOT NULL,
  workdays TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] NOT NULL,
  time_zone TEXT DEFAULT 'Africa/Lagos' NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  attendance_date DATE NOT NULL, -- Stored as Africa/Lagos date
  check_in_timestamp TIMESTAMPTZ NOT NULL, -- Server authoritative timestamp
  check_in_time_wat TIME NOT NULL,
  status attendance_status DEFAULT 'on_time' NOT NULL,
  punctuality_score NUMERIC(5,2) DEFAULT 100.00 NOT NULL CHECK (punctuality_score >= 0 AND punctuality_score <= 100),
  correction_reason TEXT,
  corrected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  corrected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Prevent duplicate check-ins on the same calendar day for an intern
  UNIQUE(profile_id, attendance_date)
);

-- 8. TASK MANAGEMENT SYSTEM
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  assigned_to_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL indicates assigned to all interns in department
  created_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  priority task_priority DEFAULT 'medium' NOT NULL,
  status task_status DEFAULT 'assigned' NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  submission_requirements TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  intern_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  deliverable_url TEXT NOT NULL,
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  review_status TEXT DEFAULT 'pending' NOT NULL CHECK (review_status IN ('pending', 'revision_requested', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_feedback TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. GIVEAWAY & CASH-PRIZE ENGINE
CREATE TABLE IF NOT EXISTS public.giveaway_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date_time TIMESTAMPTZ NOT NULL,
  scoring_period_start TIMESTAMPTZ NOT NULL,
  scoring_period_end TIMESTAMPTZ NOT NULL,
  eligible_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL, -- NULL = all departments
  prize_1st NUMERIC(10,2) DEFAULT 3000.00 NOT NULL,
  prize_2nd NUMERIC(10,2) DEFAULT 2000.00 NOT NULL,
  total_budget NUMERIC(10,2) DEFAULT 5000.00 NOT NULL,
  punctuality_weight INT DEFAULT 50 NOT NULL CHECK (punctuality_weight >= 0 AND punctuality_weight <= 100),
  task_weight INT DEFAULT 50 NOT NULL CHECK (task_weight >= 0 AND task_weight <= 100),
  minimum_attendance_rate NUMERIC(5,2) DEFAULT 0.00,
  minimum_approved_tasks INT DEFAULT 0,
  status giveaway_status DEFAULT 'draft' NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_weights_total CHECK (punctuality_weight + task_weight = 100)
);

CREATE TABLE IF NOT EXISTS public.giveaway_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID REFERENCES public.giveaway_events(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  punctuality_raw_score NUMERIC(5,2) NOT NULL,
  punctuality_normalized NUMERIC(5,2) NOT NULL,
  task_completion_raw_score NUMERIC(5,2) NOT NULL,
  task_completion_normalized NUMERIC(5,2) NOT NULL,
  final_weighted_score NUMERIC(5,2) NOT NULL,
  tie_breaker_timestamp TIMESTAMPTZ,
  rank INT NOT NULL,
  is_winner BOOLEAN DEFAULT false NOT NULL,
  prize_amount NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(giveaway_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.giveaway_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID REFERENCES public.giveaway_events(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rank INT NOT NULL CHECK (rank IN (1, 2)),
  prize_amount NUMERIC(10,2) NOT NULL,
  payment_status payment_status DEFAULT 'pending' NOT NULL,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(giveaway_id, rank) -- Enforces exactly 1 winner per rank per event
);

-- 10. ANNOUNCEMENTS & IN-APP NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT DEFAULT 'all' NOT NULL, -- 'all', 'interns', 'managers', or department ID
  is_dismissible BOOLEAN DEFAULT true NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'system' NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. AUDIT LOGS & EMAIL DELIVERY RECORDS
CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_type TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT DEFAULT 'sent' NOT NULL, -- 'sent', 'delivered', 'bounced', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role user_role,
  action TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  client_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON public.candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_token ON public.candidates(invitation_token);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_profile ON public.attendance_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON public.tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task ON public.task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_giveaways_status ON public.giveaway_events(status);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON public.in_app_notifications(profile_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at);
