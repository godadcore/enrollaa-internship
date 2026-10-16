export type UserRole = "super_admin" | "manager" | "intern" | "admin" | "lead";

export type DepartmentName =
  | "Product Research & Strategy"
  | "AI / Monitoring / ML Engineering"
  | "Backend Engineering"
  | "Frontend Engineering"
  | "UI/UX Design"
  | "Content & Operations";

export type CandidateStatus =
  | "selected"
  | "invitation_sent"
  | "registration_started"
  | "onboarding_started"
  | "submitted"
  | "onboarding_submitted"
  | "approved"
  | "activation_sent"
  | "account_activated"
  | "active"
  | "revoked"
  | "expired"
  | "withdrawn";

export interface Candidate {
  id: string;
  first_name: string;
  middle_name?: string;
  surname: string;
  sex?: "Male" | "Female";
  email: string;
  phone?: string;
  location_state?: string;
  location_city?: string;
  department: DepartmentName;
  role: string;
  intended_start_date: string;
  status: CandidateStatus;
  slack_invited: boolean;
  slack_joined: boolean;
  invitation_token: string;
  token_expires_at: string;
  invitation_sent_at?: string;
  activation_token?: string;
  activation_expires_at?: string;
  activation_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OnboardingSubmission {
  id: string;
  candidate_id: string;
  first_name: string;
  middle_name?: string;
  surname: string;
  sex: "Male" | "Female";
  email: string;
  phone: string;
  location_state: string;
  location_city: string;
  photo_url?: string;
  photo_filename?: string;
  cv_url?: string;
  cv_filename?: string;
  cv_filesize?: number;
  department: DepartmentName;
  role: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string; // Masked in all views except super-admin payments
  state_of_residence?: string;
  institution?: string;
  ip_agreement_accepted: boolean;
  agreement_version: string;
  signature_text: string;
  submitted_at: string;
  status: "pending" | "approved" | "rejected";
  approved_at?: string;
  approved_by?: string;
}

export interface AccountCredentials {
  email: string;
  password_hash: string;
  role: UserRole;
  profile_id: string;
  status: "pending_activation" | "active" | "suspended";
  created_at: string;
  last_login_at?: string;
  recovery_code?: string;
  recovery_expires_at?: string;
  recovery_attempts?: number;
}

export interface EmailDispatchRecord {
  id: string;
  to: string;
  subject: string;
  template_type: "invitation" | "activation" | "password_reset" | "password_changed";
  status: "sent" | "failed" | "queued";
  sent_at: string;
  preview_url?: string;
  error_message?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  surname: string;
  department_id?: string | null;
  department?: DepartmentName;
  role_title: string;
  phone?: string;
  avatar_url?: string;
  gender?: "Male" | "Female";
  state_of_residence?: string;
  institution?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  slack_joined?: boolean;
  bio?: string;
  is_active: boolean;
  created_at: string;
}

export type AttendanceStatus = "on_time" | "late" | "excused" | "absent";

export interface AttendanceRecord {
  id: string;
  user_id: string;
  intern_name: string;
  department: DepartmentName;
  date: string; // YYYY-MM-DD
  check_in_time: string; // ISO
  check_in_time_wat: string; // HH:mm:ss WAT
  status: AttendanceStatus;
  punctuality_score: number; // 100 for on-time, scaled down for late
  correction_reason?: string;
  corrected_by?: string;
  corrected_at?: string;
}

export interface AttendancePolicy {
  standard_target_time_wat: string; // "09:00:00"
  grace_period_minutes: number; // 15 mins (up to 09:15)
  late_cutoff_time_wat: string; // "10:30:00"
  workdays: string[]; // ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  time_zone: string; // "Africa/Lagos"
}

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "cancelled";

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  author_avatar?: string;
  message: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  acceptance_criteria?: string;
  department: DepartmentName;
  assigned_to_user_id: string; // or "all"
  assigned_to_name: string;
  assigned_by_user_id: string;
  assigned_by_name: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string; // ISO
  submission_requirements?: string;
  created_at: string;
  updated_at: string;
  comments?: TaskComment[];
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  intern_id: string;
  intern_name: string;
  deliverable_url: string;
  notes?: string;
  submitted_at: string;
  review_status: "pending" | "revision_requested" | "approved" | "rejected";
  reviewer_id?: string;
  reviewer_name?: string;
  review_feedback?: string;
  reviewed_at?: string;
}

export type ReportStatus = "draft" | "submitted" | "changes_requested" | "reviewed";

export interface WeeklyReport {
  id: string;
  department: DepartmentName;
  lead_id: string;
  lead_user_id?: string;
  lead_name: string;
  week_number?: number;
  reporting_period_start?: string; // YYYY-MM-DD
  reporting_period_end?: string; // YYYY-MM-DD
  start_date?: string;
  end_date?: string;
  intern_participation_summary?: string;
  attendance_summary?: any;
  tasks_summary?: any;
  tasks_completed_summary?: string;
  tasks_in_progress_summary?: string;
  individual_progress_notes?: string;
  blockers_and_challenges?: string;
  blockers_and_risks?: string;
  admin_support_needed?: string;
  resource_requests?: string;
  lead_recommendations?: string;
  admin_feedback?: string;
  status: ReportStatus;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
  updated_at: string;
}

export type GiveawayStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "completed"
  | "cancelled";

export interface GiveawayEvent {
  id: string;
  title: string;
  description: string;
  scheduled_date_time: string; // ISO in Africa/Lagos
  scoring_period_start: string; // ISO
  scoring_period_end: string; // ISO
  eligible_departments?: "all" | DepartmentName[];
  prize_1st: number; // ₦3,000 default
  prize_2nd: number; // ₦2,000 default
  total_budget: number; // ₦5,000 default
  punctuality_weight: number; // 50 (%)
  task_weight: number; // 50 (%)
  minimum_attendance_rate?: number; // e.g. 70%
  minimum_approved_tasks?: number; // e.g. 1
  status: GiveawayStatus;
  created_by?: string;
  created_at: string;
  executed_at?: string;
}

export interface GiveawayScore {
  id: string;
  giveaway_id: string;
  intern_id: string;
  intern_name: string;
  department: DepartmentName;
  punctuality_score: number; // 0-100 normalized
  task_completion_score: number; // 0-100 normalized
  final_score: number; // weighted sum
  tie_breaker_timestamp: string; // earliest check-in timestamp during period
  rank: number;
  is_winner: boolean;
  prize_amount?: number;
}

export type PaymentStatus = "pending" | "processing" | "paid" | "failed";

export interface GiveawayWinner {
  id: string;
  giveaway_id: string;
  giveaway_title: string;
  intern_id: string;
  intern_name: string;
  intern_email: string;
  department: DepartmentName;
  rank: 1 | 2;
  prize_amount: number;
  final_score: number;
  total_score?: number;
  payment_status: PaymentStatus;
  payment_reference?: string;
  paid_at?: string;
  paid_by?: string;
  bank_name?: string;
  account_name?: string;
  account_number_masked?: string;
  account_number_full?: string;
}

export interface InAppNotification {
  id: string;
  user_id: string; // or "all"
  title: string;
  message: string;
  type: "system" | "task" | "attendance" | "giveaway" | "announcement" | "report";
  read: boolean;
  link?: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_audience: "all" | "interns" | "leads" | "managers" | DepartmentName;
  is_dismissible: boolean;
  created_by: string;
  created_at: string;
  expires_at?: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  target_entity: string;
  target_id: string;
  details: string;
  created_at: string;
}
