import "server-only";

import { AuthorizationError, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { isProgrammeWideRole, requireDepartmentScope } from "@/lib/data/scope";
import { recordSensitiveAudit } from "@/lib/data/audit";
import { notifyUnique } from "@/lib/operations/notify";
import { getProgrammeWeekWAT } from "@/lib/date-utils";

export async function operationsSummary(profile: TrustedProfile) {
  const db = privilegedDatabase();
  if (profile.role === "intern") {
    requireDepartmentScope(profile, profile.department_id);
  }
  const departmentFilter = isProgrammeWideRole(profile.role) ? null : requireDepartmentScope(profile, profile.department_id);
  const internQuery = db.from("profiles").select("id, department_id").eq("role", "intern").eq("is_active", true);
  const { data: interns } = profile.role === "intern"
    ? { data: [{ id: profile.id, department_id: profile.department_id }] }
    : departmentFilter
      ? await internQuery.eq("department_id", departmentFilter)
      : await internQuery;
  const internIds = (interns ?? []).map((row) => row.id);
  const attendanceQuery = db.from("attendance_records").select("id, intern_profile_id, department_id, status, punctuality_score");
  const { data: attendance } = profile.role === "intern"
    ? await attendanceQuery.eq("intern_profile_id", profile.id)
    : departmentFilter
      ? await attendanceQuery.eq("department_id", departmentFilter)
      : await attendanceQuery;
  const taskQuery = db.from("tasks").select("id, department_id, status, due_at, assigned_to_profile_id");
  const { data: tasks } = departmentFilter ? await taskQuery.eq("department_id", departmentFilter) : await taskQuery;
  const onboardingQuery = db.from("onboarding_submissions").select("id, department_id, status").neq("status", "draft");
  const { data: onboarding } = departmentFilter ? await onboardingQuery.eq("department_id", departmentFilter) : await onboardingQuery;
  const records = attendance ?? [];
  const taskRows = (tasks ?? []).filter((row) => {
    if (profile.role !== "intern") return true;
    return row.assigned_to_profile_id === profile.id || (row.assigned_to_profile_id == null && row.department_id === profile.department_id);
  });
  const now = Date.now();
  return {
    internCount: internIds.length,
    attendanceCount: records.length,
    onTimeCount: records.filter((row) => row.status === "on_time").length,
    lateCount: records.filter((row) => row.status === "late").length,
    punctualityRate: records.length ? Math.round((records.filter((row) => row.status === "on_time").length / records.length) * 100) : 0,
    taskCount: taskRows.length,
    submittedTasks: taskRows.filter((row) => row.status === "submitted").length,
    approvedTasks: taskRows.filter((row) => row.status === "approved").length,
    overdueTasks: taskRows.filter((row) => row.status !== "approved" && row.status !== "cancelled" && new Date(row.due_at).getTime() < now).length,
    onboardingSubmitted: (onboarding ?? []).filter((row) => row.status === "submitted").length,
    onboardingApproved: (onboarding ?? []).filter((row) => row.status === "approved").length,
  };
}

export async function listWeeklyReports(profile: TrustedProfile) {
  if (!["admin", "super_admin", "lead", "manager"].includes(profile.role)) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
  let query = privilegedDatabase()
    .from("weekly_reports")
    .select("id, department_id, lead_profile_id, week_number, period_start, period_end, attendance_summary, tasks_completed_summary, tasks_in_progress_summary, blockers_and_risks, resource_requests, admin_feedback, status, submitted_at, reviewed_at, created_at, departments(name), profiles!weekly_reports_lead_profile_id_fkey(first_name, surname)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!isProgrammeWideRole(profile.role)) query = query.eq("department_id", requireDepartmentScope(profile, profile.department_id));
  const { data, error } = await query;
  if (error) throw new DataAccessError("Unable to load weekly reports.", 500);
  return (data ?? []).map((row) => ({
    id: row.id,
    departmentId: row.department_id,
    department: Array.isArray(row.departments) ? row.departments[0]?.name : (row.departments as { name?: string } | null)?.name,
    leadName: (() => {
      const lead = Array.isArray(row.profiles) ? row.profiles[0] : (row.profiles as { first_name?: string; surname?: string } | null);
      return lead ? `${lead.first_name} ${lead.surname}` : "";
    })(),
    weekNumber: row.week_number,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    attendanceSummary: row.attendance_summary,
    tasksCompletedSummary: row.tasks_completed_summary,
    tasksInProgressSummary: row.tasks_in_progress_summary,
    blockersAndRisks: row.blockers_and_risks,
    resourceRequests: row.resource_requests,
    adminFeedback: row.admin_feedback,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  }));
}

export async function saveWeeklyReport(profile: TrustedProfile, body: Record<string, unknown>) {
  if (profile.role !== "lead" && profile.role !== "manager" && !isProgrammeWideRole(profile.role)) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
  const departmentId = isProgrammeWideRole(profile.role)
    ? (typeof body.departmentId === "string" ? body.departmentId : "")
    : requireDepartmentScope(profile, profile.department_id);
  if (!departmentId) throw new DataAccessError("A department is required.", 400);
  const currentWeek = getProgrammeWeekWAT();
  const weekNumber = currentWeek.weekNumber;
  const periodStart = currentWeek.periodStart;
  const periodEnd = currentWeek.periodEnd;
  const fields = {
    attendance_summary: typeof body.attendanceSummary === "string" ? body.attendanceSummary.slice(0, 4000) : "",
    tasks_completed_summary: typeof body.tasksCompletedSummary === "string" ? body.tasksCompletedSummary.slice(0, 4000) : "",
    tasks_in_progress_summary: typeof body.tasksInProgressSummary === "string" ? body.tasksInProgressSummary.slice(0, 4000) : "",
    blockers_and_risks: typeof body.blockersAndRisks === "string" ? body.blockersAndRisks.slice(0, 4000) : "",
    resource_requests: typeof body.resourceRequests === "string" ? body.resourceRequests.slice(0, 4000) : "",
    updated_at: new Date().toISOString(),
  };
  const db = privilegedDatabase();
  const { data: existing } = await db
    .from("weekly_reports")
    .select("id, status")
    .eq("department_id", departmentId)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (existing && existing.status === "reviewed") throw new DataAccessError("A reviewed report cannot be edited.", 409);
  if (existing) {
    const { error } = await db.from("weekly_reports").update(fields).eq("id", existing.id);
    if (error) throw new DataAccessError("Unable to save the report.", 500);
    return { id: existing.id };
  }
  const { data, error } = await db
    .from("weekly_reports")
    .insert({
      department_id: departmentId,
      lead_profile_id: profile.id,
      week_number: weekNumber,
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft",
      ...fields,
    })
    .select("id")
    .single();
  if (error || !data) throw new DataAccessError("Unable to save the report.", 500);
  return { id: data.id };
}

export async function submitWeeklyReport(profile: TrustedProfile, reportId: string) {
  const db = privilegedDatabase();
  const { data: report } = await db.from("weekly_reports").select("id, department_id, status").eq("id", reportId).maybeSingle();
  if (!report) throw new DataAccessError("Report not found.", 404);
  if (!isProgrammeWideRole(profile.role)) requireDepartmentScope(profile, report.department_id);
  if (report.status === "reviewed") throw new DataAccessError("A reviewed report cannot be submitted again.", 409);
  const { error } = await db
    .from("weekly_reports")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw new DataAccessError("Unable to submit the report.", 500);
  const { data: admins } = await db.from("profiles").select("id").in("role", ["admin", "super_admin"]).eq("is_active", true);
  for (const admin of admins ?? []) {
    await notifyUnique({
      recipientProfileId: admin.id,
      title: "Weekly report submitted",
      message: `${profile.first_name} submitted a department weekly report.`,
      type: "report",
      sourceType: "weekly_report_submitted",
      sourceId: reportId,
    });
  }
  await recordSensitiveAudit({ actor: profile, action: "weekly_report_submitted", targetType: "weekly_report", targetId: reportId });
}

export async function reviewWeeklyReport(profile: TrustedProfile, body: Record<string, unknown>) {
  if (!isProgrammeWideRole(profile.role)) throw new AuthorizationError("You do not have access to this resource.", 403);
  const id = typeof body.id === "string" ? body.id : "";
  const decision = body.decision;
  const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 2000) : "";
  if (!id) throw new DataAccessError("A report is required.", 400);
  if (decision !== "reviewed" && decision !== "changes_requested") throw new DataAccessError("The review decision is invalid.", 400);
  const db = privilegedDatabase();
  const { data: report } = await db.from("weekly_reports").select("id, status, lead_profile_id").eq("id", id).maybeSingle();
  if (!report) throw new DataAccessError("Report not found.", 404);
  if (report.status !== "submitted" && report.status !== "changes_requested") throw new DataAccessError("Only submitted reports can be reviewed.", 409);
  const { error } = await db
    .from("weekly_reports")
    .update({
      status: decision,
      admin_feedback: feedback || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by_profile_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new DataAccessError("Unable to review the report.", 500);
  await notifyUnique({
    recipientProfileId: report.lead_profile_id,
    title: "Weekly report reviewed",
    message: decision === "reviewed" ? "Your weekly report was reviewed." : "Changes were requested on your weekly report.",
    type: "report",
    sourceType: "weekly_report_reviewed",
    sourceId: id,
  });
  await recordSensitiveAudit({ actor: profile, action: "weekly_report_reviewed", targetType: "weekly_report", targetId: id, metadata: { decision } });
}
