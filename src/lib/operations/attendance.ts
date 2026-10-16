import "server-only";

import { AuthorizationError, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { isProgrammeWideRole, requireDepartmentScope } from "@/lib/data/scope";
import { recordSensitiveAudit } from "@/lib/data/audit";
import { evaluatePunctuality, getDateStringWAT } from "@/lib/date-utils";

function attendanceDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return getDateStringWAT(value instanceof Date ? value : new Date(String(value ?? "")));
}

function requireAttendanceParticipant(profile: TrustedProfile) {
  if (profile.role !== "intern" && profile.role !== "lead") {
    throw new AuthorizationError("Intern or department-lead attendance is required.", 403);
  }
  if (!profile.department_id) throw new DataAccessError("This account is not assigned to a department.", 400);
}

export async function listAttendance(profile: TrustedProfile) {
  const db = privilegedDatabase();
  let query = db
    .from("attendance_records")
    .select("id, intern_profile_id, department_id, attendance_date, check_in_at, check_out_at, status, punctuality_score, correction_reason, profiles!attendance_records_intern_profile_id_fkey(first_name, surname), departments(name)")
    .order("attendance_date", { ascending: false })
    .limit(200);
  if (profile.role === "intern") query = query.eq("intern_profile_id", profile.id);
  else if (!isProgrammeWideRole(profile.role)) query = query.eq("department_id", requireDepartmentScope(profile, profile.department_id));
  else if (!["admin", "super_admin", "lead", "manager"].includes(profile.role)) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
  const { data, error } = await query;
  if (error) throw new DataAccessError("Unable to load attendance records.", 500);
  return (data ?? []).map(mapAttendance);
}

function mapAttendance(row: Record<string, unknown>) {
  const intern = Array.isArray(row.profiles) ? row.profiles[0] : (row.profiles as { first_name?: string; surname?: string } | null);
  const department = Array.isArray(row.departments) ? row.departments[0] : (row.departments as { name?: string } | null);
  return {
    id: row.id,
    internProfileId: row.intern_profile_id,
    internName: intern ? `${intern.first_name} ${intern.surname}` : "",
    departmentId: row.department_id,
    department: department?.name ?? "",
    date: attendanceDate(row.attendance_date),
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    status: row.status,
    punctualityScore: row.punctuality_score,
    correctionReason: row.correction_reason,
  };
}

export async function checkIn(profile: TrustedProfile) {
  requireAttendanceParticipant(profile);
  const now = new Date();
  const date = getDateStringWAT(now);
  const evaluation = evaluatePunctuality(now);
  const { data, error } = await privilegedDatabase()
    .from("attendance_records")
    .insert({
      intern_profile_id: profile.id,
      department_id: profile.department_id,
      attendance_date: date,
      check_in_at: now.toISOString(),
      status: evaluation.status,
      punctuality_score: evaluation.punctualityScore,
    })
    .select("id, intern_profile_id, department_id, attendance_date, check_in_at, check_out_at, status, punctuality_score, correction_reason")
    .single();
  if (error) {
    if (/unique|duplicate/i.test(error.message)) throw new DataAccessError("You have already checked in today.", 409);
    throw new DataAccessError("Unable to record check-in.", 500);
  }
  await recordSensitiveAudit({
    actor: profile,
    action: "attendance_checkin",
    targetType: "attendance_record",
    targetId: data.id,
    metadata: { status: evaluation.status },
  });
  return {
    record: {
      id: data.id,
      internProfileId: data.intern_profile_id,
      internName: `${profile.first_name} ${profile.surname}`,
      departmentId: data.department_id,
      department: profile.department ?? "",
      date: data.attendance_date,
      checkInAt: data.check_in_at,
      checkOutAt: data.check_out_at,
      status: data.status,
      punctualityScore: data.punctuality_score,
      correctionReason: data.correction_reason,
    },
    message:
      evaluation.status === "on_time"
        ? `On-time check-in recorded at ${evaluation.formattedTimeWAT} WAT.`
        : `Late check-in recorded at ${evaluation.formattedTimeWAT} WAT.`,
  };
}

export async function checkOut(profile: TrustedProfile) {
  requireAttendanceParticipant(profile);
  const date = getDateStringWAT(new Date());
  const db = privilegedDatabase();
  const { data: existing } = await db
    .from("attendance_records")
    .select("id, check_in_at, check_out_at")
    .eq("intern_profile_id", profile.id)
    .eq("attendance_date", date)
    .maybeSingle();
  if (!existing?.check_in_at) throw new DataAccessError("Check in before checking out.", 409);
  if (existing.check_out_at) throw new DataAccessError("You have already checked out today.", 409);
  const { error } = await db
    .from("attendance_records")
    .update({ check_out_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) throw new DataAccessError("Unable to record check-out.", 500);
  await recordSensitiveAudit({
    actor: profile,
    action: "attendance_checkout",
    targetType: "attendance_record",
    targetId: existing.id,
  });
}

export async function correctAttendance(profile: TrustedProfile, body: Record<string, unknown>) {
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 400) : "";
  if (!id) throw new DataAccessError("An attendance record is required.", 400);
  if (status !== "on_time" && status !== "late" && status !== "excused" && status !== "absent") {
    throw new DataAccessError("The attendance status is invalid.", 400);
  }
  if (!reason) throw new DataAccessError("A correction reason is required.", 400);
  const db = privilegedDatabase();
  const { data: existing } = await db.from("attendance_records").select("id, department_id").eq("id", id).maybeSingle();
  if (!existing) throw new DataAccessError("Attendance record not found.", 404);
  if (!isProgrammeWideRole(profile.role)) requireDepartmentScope(profile, existing.department_id);
  const patch: Record<string, unknown> = {
    status,
    correction_reason: reason,
    corrected_by_profile_id: profile.id,
    corrected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (status === "excused" || status === "absent") patch.punctuality_score = status === "excused" ? 100 : 0;
  const { error } = await db.from("attendance_records").update(patch).eq("id", id);
  if (error) throw new DataAccessError("Unable to correct attendance.", 500);
  await recordSensitiveAudit({
    actor: profile,
    action: "attendance_corrected",
    targetType: "attendance_record",
    targetId: id,
    metadata: { status },
  });
}
