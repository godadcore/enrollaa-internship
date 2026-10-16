import "server-only";

import { AuthorizationError, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { isProgrammeWideRole } from "@/lib/data/scope";
import { recordSensitiveAudit } from "@/lib/data/audit";
import { notifyUnique } from "@/lib/operations/notify";

export async function listGiveaways(profile: TrustedProfile) {
  const db = privilegedDatabase();
  const { data: giveaways, error } = await db
    .from("giveaways")
    .select("id, title, description, scheduled_at, scoring_period_start, scoring_period_end, prize_1st, prize_2nd, punctuality_weight, task_weight, status, executed_at, created_at")
    .order("scheduled_at", { ascending: false });
  if (error) throw new DataAccessError("Unable to load giveaways.", 500);
  const { data: winnerRows } = await db
    .from("giveaway_winners")
    .select("id, giveaway_id, intern_profile_id, rank, prize_amount, final_score, payment_status, profiles!giveaway_winners_intern_profile_id_fkey(first_name, surname, email, department_id)");
  const { data: departments } = await db.from("departments").select("id, name");
  const deptName = new Map((departments ?? []).map((row) => [row.id, row.name]));
  const mappedWinners = (winnerRows ?? []).map((row) => {
    const intern = Array.isArray(row.profiles) ? row.profiles[0] : (row.profiles as { first_name?: string; surname?: string; email?: string; department_id?: string } | null);
    return {
      id: row.id,
      giveawayId: row.giveaway_id,
      internName: intern ? `${intern.first_name} ${intern.surname}` : "",
      internEmail: isProgrammeWideRole(profile.role) ? intern?.email ?? "" : "",
      department: intern?.department_id ? deptName.get(intern.department_id) ?? "" : "",
      rank: row.rank,
      prizeAmount: row.prize_amount,
      finalScore: Number(row.final_score),
      paymentStatus: isProgrammeWideRole(profile.role) ? row.payment_status : undefined,
    };
  });
  return {
    giveaways: (giveaways ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      scheduledAt: row.scheduled_at,
      scoringPeriodStart: row.scoring_period_start,
      scoringPeriodEnd: row.scoring_period_end,
      prize1st: row.prize_1st,
      prize2nd: row.prize_2nd,
      totalBudget: row.prize_1st + row.prize_2nd,
      punctualityWeight: row.punctuality_weight,
      taskWeight: row.task_weight,
      status: row.status,
      executedAt: row.executed_at,
      createdAt: row.created_at,
    })),
    winners: mappedWinners,
  };
}

export async function internStanding(profile: TrustedProfile) {
  if (profile.role !== "intern") throw new AuthorizationError("Intern authorization is required.", 403);
  const db = privilegedDatabase();
  const { data: attendance } = await db.from("attendance_records").select("status").eq("intern_profile_id", profile.id);
  const { data: tasks } = await db
    .from("tasks")
    .select("id, status, assigned_to_profile_id, department_id")
    .or(`assigned_to_profile_id.eq.${profile.id},assigned_to_profile_id.is.null`);
  const mine = (tasks ?? []).filter((task) => task.assigned_to_profile_id === profile.id || task.department_id === profile.department_id);
  const { data: submissions } = await db.from("task_submissions").select("task_id, review_status").eq("intern_profile_id", profile.id);
  const approved = (submissions ?? []).filter((row) => row.review_status === "approved").length;
  const onTime = (attendance ?? []).filter((row) => row.status === "on_time").length;
  const attendanceScore = attendance?.length ? Math.round((onTime / attendance.length) * 100) : 100;
  const taskScore = mine.length ? Math.round((approved / mine.length) * 100) : 100;
  const composite = Math.round(attendanceScore * 0.5 + taskScore * 0.5);
  return { attendanceScore, taskScore, composite, eligible: composite >= 80 };
}

export async function createGiveaway(profile: TrustedProfile, body: Record<string, unknown>) {
  if (!isProgrammeWideRole(profile.role)) throw new AuthorizationError("You do not have access to this resource.", 403);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  const scheduledAt = typeof body.scheduledAt === "string" ? body.scheduledAt : "";
  const start = typeof body.scoringPeriodStart === "string" ? body.scoringPeriodStart : scheduledAt;
  const end = typeof body.scoringPeriodEnd === "string" ? body.scoringPeriodEnd : scheduledAt;
  if (title.length < 3 || !scheduledAt) throw new DataAccessError("A title and scheduled date are required.", 400);
  const prize1st = Number(body.prize1st ?? 3000);
  const prize2nd = Number(body.prize2nd ?? 2000);
  const punctualityWeight = Number(body.punctualityWeight ?? 50);
  const taskWeight = Number(body.taskWeight ?? 50);
  if (!Number.isFinite(prize1st) || prize1st < 0 || !Number.isFinite(prize2nd) || prize2nd < 0) {
    throw new DataAccessError("Prize amounts are invalid.", 400);
  }
  if (punctualityWeight + taskWeight !== 100) throw new DataAccessError("Punctuality and task weights must total 100.", 400);
  const { data, error } = await privilegedDatabase()
    .from("giveaways")
    .insert({
      title,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "",
      scheduled_at: new Date(scheduledAt).toISOString(),
      scoring_period_start: new Date(start).toISOString(),
      scoring_period_end: new Date(end).toISOString(),
      prize_1st: prize1st,
      prize_2nd: prize2nd,
      punctuality_weight: punctualityWeight,
      task_weight: taskWeight,
      status: "scheduled",
      created_by_profile_id: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) throw new DataAccessError("Unable to schedule the giveaway.", 500);
  await recordSensitiveAudit({ actor: profile, action: "giveaway_created", targetType: "giveaway", targetId: data.id });
  return { id: data.id };
}

export async function cancelGiveaway(profile: TrustedProfile, id: string) {
  if (!isProgrammeWideRole(profile.role)) throw new AuthorizationError("You do not have access to this resource.", 403);
  const { data } = await privilegedDatabase().from("giveaways").select("id, status").eq("id", id).maybeSingle();
  if (!data) throw new DataAccessError("Giveaway not found.", 404);
  if (data.status === "completed") throw new DataAccessError("A completed giveaway cannot be cancelled.", 409);
  const { error } = await privilegedDatabase().from("giveaways").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new DataAccessError("Unable to cancel the giveaway.", 500);
  await recordSensitiveAudit({ actor: profile, action: "giveaway_cancelled", targetType: "giveaway", targetId: id });
}

export async function executeGiveaway(profile: TrustedProfile, id: string) {
  if (!isProgrammeWideRole(profile.role)) throw new AuthorizationError("You do not have access to this resource.", 403);
  const db = privilegedDatabase();
  const { data: event } = await db.from("giveaways").select("*").eq("id", id).maybeSingle();
  if (!event) throw new DataAccessError("Giveaway not found.", 404);
  if (event.status !== "scheduled" && event.status !== "running") throw new DataAccessError("This giveaway cannot be completed.", 409);
  const { data: interns } = await db.from("profiles").select("id, first_name, surname, department_id").eq("role", "intern").eq("is_active", true);
  const internList = interns ?? [];
  if (!internList.length) throw new DataAccessError("No active interns are eligible.", 409);
  const start = event.scoring_period_start;
  const end = event.scoring_period_end;
  const { data: attendance } = await db
    .from("attendance_records")
    .select("intern_profile_id, status, check_in_at, attendance_date")
    .gte("attendance_date", start.slice(0, 10))
    .lte("attendance_date", end.slice(0, 10));
  const { data: tasks } = await db.from("tasks").select("id, assigned_to_profile_id, department_id, created_at");
  const { data: submissions } = await db.from("task_submissions").select("task_id, intern_profile_id, review_status, submitted_at");
  const scores = internList.map((intern) => {
    const records = (attendance ?? []).filter((row) => row.intern_profile_id === intern.id);
    const onTime = records.filter((row) => row.status === "on_time").length;
    const punctuality = records.length ? (onTime / records.length) * 100 : 0;
    const internTasks = (tasks ?? []).filter(
      (task) => task.assigned_to_profile_id === intern.id || (task.assigned_to_profile_id == null && task.department_id === intern.department_id),
    );
    const approved = (submissions ?? []).filter((row) => row.intern_profile_id === intern.id && row.review_status === "approved").length;
    const taskScore = internTasks.length ? (approved / internTasks.length) * 100 : 0;
    const finalScore = punctuality * (event.punctuality_weight / 100) + taskScore * (event.task_weight / 100);
    const earliest = records.map((row) => row.check_in_at).filter(Boolean).sort()[0] || "9999";
    return { intern, punctuality, taskScore, finalScore, earliest };
  });
  scores.sort((a, b) => b.finalScore - a.finalScore || a.earliest.localeCompare(b.earliest));
  const winners = scores.slice(0, 2).filter((row, index, list) => list.findIndex((item) => item.intern.id === row.intern.id) === index);
  if (!winners.length) throw new DataAccessError("No eligible winners could be selected.", 409);
  const rows = winners.map((row, index) => ({
    giveaway_id: id,
    intern_profile_id: row.intern.id,
    rank: index + 1,
    prize_amount: index === 0 ? event.prize_1st : event.prize_2nd,
    final_score: Math.round(row.finalScore * 10) / 10,
    payment_status: "pending",
  }));
  const { error: winnerError } = await db.from("giveaway_winners").insert(rows);
  if (winnerError) {
    if (/unique|duplicate/i.test(winnerError.message)) throw new DataAccessError("This giveaway already has recorded winners.", 409);
    throw new DataAccessError("Unable to record winners.", 500);
  }
  const { error } = await db.from("giveaways").update({ status: "completed", executed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new DataAccessError("Unable to complete the giveaway.", 500);
  for (const row of rows) {
    await notifyUnique({
      recipientProfileId: row.intern_profile_id,
      title: "Giveaway result",
      message: `You placed #${row.rank} in ${event.title}.`,
      type: "giveaway",
      sourceType: "giveaway_winner",
      sourceId: id,
    });
  }
  await recordSensitiveAudit({ actor: profile, action: "giveaway_completed", targetType: "giveaway", targetId: id });
  return { winnerCount: rows.length };
}

export async function updateWinnerPayment(profile: TrustedProfile, body: Record<string, unknown>) {
  if (!isProgrammeWideRole(profile.role)) throw new AuthorizationError("You do not have access to this resource.", 403);
  const id = typeof body.id === "string" ? body.id : "";
  const status = body.paymentStatus;
  if (!id || (status !== "paid" && status !== "failed" && status !== "pending")) throw new DataAccessError("A valid payment status is required.", 400);
  const { error } = await privilegedDatabase()
    .from("giveaway_winners")
    .update({
      payment_status: status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      paid_by_profile_id: status === "paid" ? profile.id : null,
    })
    .eq("id", id);
  if (error) throw new DataAccessError("Unable to update payment status.", 500);
  await recordSensitiveAudit({ actor: profile, action: "giveaway_payment_updated", targetType: "giveaway_winner", targetId: id, metadata: { status } });
}
