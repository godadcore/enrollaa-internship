import "server-only";

import { AuthorizationError, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { isProgrammeWideRole, requireDepartmentScope } from "@/lib/data/scope";
import { recordSensitiveAudit } from "@/lib/data/audit";
import { notifyUnique } from "@/lib/operations/notify";

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const STAFF_ROLES = ["admin", "super_admin", "lead", "manager"] as const;

function missingReplyColumn(error: { message?: string; code?: string } | null) {
  return error?.code === "42703" && /parent_comment_id/i.test(error?.message ?? "");
}

function canManageTasks(profile: TrustedProfile) {
  return STAFF_ROLES.includes(profile.role as (typeof STAFF_ROLES)[number]);
}

function internCanSee(profile: TrustedProfile, departmentId: string, assignedTo: string | null) {
  if (profile.role !== "intern") return false;
  if (assignedTo === profile.id) return true;
  return assignedTo == null && profile.department_id === departmentId;
}

export async function listTasks(profile: TrustedProfile) {
  const db = privilegedDatabase();
  let query = db
    .from("tasks")
    .select(
      "id, title, description, instructions, acceptance_criteria, submission_requirements, department_id, assigned_to_profile_id, created_by_profile_id, priority, status, due_at, created_at, updated_at, departments(name), assignee:profiles!tasks_assigned_to_profile_id_fkey(first_name, surname), creator:profiles!tasks_created_by_profile_id_fkey(first_name, surname)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (profile.role === "intern") {
    query = query.or(`assigned_to_profile_id.eq.${profile.id},assigned_to_profile_id.is.null`);
  } else if (!isProgrammeWideRole(profile.role)) {
    query = query.eq("department_id", requireDepartmentScope(profile, profile.department_id));
  } else if (!canManageTasks(profile)) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
  const { data, error } = await query;
  if (error) throw new DataAccessError("Unable to load tasks.", 500);
  const rows = (data ?? []).filter((row) => {
    if (profile.role !== "intern") return true;
    return internCanSee(profile, row.department_id, row.assigned_to_profile_id);
  });
  const ids = rows.map((row) => row.id);
  const { data: submissions } = ids.length
    ? await db.from("task_submissions").select("id, task_id, intern_profile_id, deliverable_url, notes, submitted_at, review_status, review_feedback, reviewed_at, profiles!task_submissions_intern_profile_id_fkey(first_name, surname)").in("task_id", ids)
    : { data: [] };
  let comments: Record<string, unknown>[] = [];
  if (ids.length) {
    const withReplies = await db.from("task_comments").select("id, task_id, author_profile_id, parent_comment_id, message, created_at, profiles!task_comments_author_profile_id_fkey(first_name, surname, role)").in("task_id", ids).order("created_at");
    if (!withReplies.error) comments = withReplies.data ?? [];
    else if (missingReplyColumn(withReplies.error)) {
      const legacy = await db.from("task_comments").select("id, task_id, author_profile_id, message, created_at, profiles!task_comments_author_profile_id_fkey(first_name, surname, role)").in("task_id", ids).order("created_at");
      if (legacy.error) throw new DataAccessError("Unable to load task comments.", 500);
      comments = legacy.data ?? [];
    } else throw new DataAccessError("Unable to load task comments.", 500);
  }
  return rows.map((row) => mapTask(row, submissions ?? [], comments ?? [], profile));
}

function nameOf(value: unknown) {
  const row = Array.isArray(value) ? value[0] : (value as { first_name?: string; surname?: string; name?: string } | null);
  if (!row) return "";
  if (row.name) return row.name;
  return `${row.first_name ?? ""} ${row.surname ?? ""}`.trim();
}

function mapTask(
  row: Record<string, unknown>,
  submissions: Record<string, unknown>[],
  comments: Record<string, unknown>[],
  profile: TrustedProfile,
) {
  const mine = submissions.filter((item) => item.task_id === row.id);
  const visible =
    profile.role === "intern" ? mine.filter((item) => item.intern_profile_id === profile.id) : mine;
  const internSubmission = visible[0];
  let displayStatus = String(row.status);
  if (row.assigned_to_profile_id == null && internSubmission) {
    const review = String(internSubmission.review_status);
    displayStatus = review === "pending" ? "submitted" : review;
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    acceptanceCriteria: row.acceptance_criteria,
    submissionRequirements: row.submission_requirements,
    departmentId: row.department_id,
    department: nameOf(row.departments),
    assignedToProfileId: row.assigned_to_profile_id,
    assignedToName: row.assigned_to_profile_id ? nameOf(row.assignee) : "All department interns",
    createdByProfileId: row.created_by_profile_id,
    createdByName: nameOf(row.creator),
    priority: row.priority,
    status: displayStatus,
    storedStatus: row.status,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submissions: visible.map((item) => ({
      id: item.id,
      internProfileId: item.intern_profile_id,
      internName: nameOf(item.profiles),
      deliverableUrl: item.deliverable_url,
      notes: item.notes,
      submittedAt: item.submitted_at,
      reviewStatus: item.review_status,
      reviewFeedback: item.review_feedback,
      reviewedAt: item.reviewed_at,
    })),
    comments: comments
      .filter((item) => item.task_id === row.id)
      .map((item) => {
        const author = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        return {
          id: item.id,
          authorProfileId: item.author_profile_id,
          parentCommentId: item.parent_comment_id,
          authorName: nameOf(item.profiles),
          authorRole: (author as { role?: string } | null)?.role ?? "",
          message: item.message,
          createdAt: item.created_at,
        };
      }),
  };
}

export async function createTask(profile: TrustedProfile, body: Record<string, unknown>) {
  if (!canManageTasks(profile)) throw new AuthorizationError("You do not have access to this resource.", 403);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 4000) : "";
  const dueAt = typeof body.dueAt === "string" ? body.dueAt : "";
  const priority = typeof body.priority === "string" ? body.priority : "medium";
  if (title.length < 3) throw new DataAccessError("A task title is required.", 400);
  if (!dueAt || Number.isNaN(Date.parse(dueAt))) throw new DataAccessError("A due date is required.", 400);
  if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) throw new DataAccessError("The selected priority is invalid.", 400);
  let departmentId = isProgrammeWideRole(profile.role)
    ? (typeof body.departmentId === "string" ? body.departmentId : profile.department_id || "")
    : requireDepartmentScope(profile, profile.department_id);
  if (!isProgrammeWideRole(profile.role)) requireDepartmentScope(profile, departmentId);
  let assignedTo: string | null = null;
  if (typeof body.assignedToProfileId === "string" && body.assignedToProfileId && body.assignedToProfileId !== "all") {
    assignedTo = body.assignedToProfileId;
    const { data: intern } = await privilegedDatabase()
      .from("profiles")
      .select("id, role, department_id, is_active, first_name, surname")
      .eq("id", assignedTo)
      .maybeSingle();
    if (!intern || intern.role !== "intern" || !intern.is_active) throw new DataAccessError("The assigned intern was not found.", 404);
    if (!isProgrammeWideRole(profile.role) && intern.department_id !== profile.department_id) {
      throw new AuthorizationError("You do not have access to this department.", 403);
    }
    if (!departmentId) departmentId = intern.department_id || "";
    if (intern.department_id !== departmentId) throw new DataAccessError("The intern is not in that department.", 400);
  }
  if (!departmentId) throw new DataAccessError("A department is required.", 400);
  const { data, error } = await privilegedDatabase()
    .from("tasks")
    .insert({
      title,
      description,
      instructions: typeof body.instructions === "string" ? body.instructions.trim().slice(0, 4000) : null,
      acceptance_criteria: typeof body.acceptanceCriteria === "string" ? body.acceptanceCriteria.trim().slice(0, 4000) : null,
      submission_requirements:
        typeof body.submissionRequirements === "string"
          ? body.submissionRequirements.trim().slice(0, 400)
          : "Submit your repository URL, Figma link, or pull request with a short summary.",
      department_id: departmentId,
      assigned_to_profile_id: assignedTo,
      created_by_profile_id: profile.id,
      priority,
      status: "assigned",
      due_at: new Date(dueAt).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new DataAccessError("Unable to create the task.", 500);
  if (assignedTo) {
    await notifyUnique({
      recipientProfileId: assignedTo,
      title: "New task assigned",
      message: `${profile.first_name} assigned you: ${title}`,
      type: "task",
      link: "/portal",
      sourceType: "task_assigned",
      sourceId: data.id,
    });
  } else {
    const { data: interns } = await privilegedDatabase()
      .from("profiles")
      .select("id")
      .eq("role", "intern")
      .eq("is_active", true)
      .eq("department_id", departmentId);
    for (const intern of interns ?? []) {
      await notifyUnique({
        recipientProfileId: intern.id,
        title: "New department task",
        message: `${profile.first_name} assigned a department task: ${title}`,
        type: "task",
        link: "/portal",
        sourceType: "task_assigned",
        sourceId: data.id,
      });
    }
  }
  await recordSensitiveAudit({ actor: profile, action: "task_created", targetType: "task", targetId: data.id });
  return { id: data.id };
}

export async function updateTask(profile: TrustedProfile, body: Record<string, unknown>) {
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) throw new DataAccessError("A task is required.", 400);
  const db = privilegedDatabase();
  const { data: task } = await db.from("tasks").select("id, department_id, assigned_to_profile_id, status").eq("id", id).maybeSingle();
  if (!task) throw new DataAccessError("Task not found.", 404);
  if (profile.role === "intern") {
    if (!internCanSee(profile, task.department_id, task.assigned_to_profile_id)) {
      throw new AuthorizationError("You do not have access to this resource.", 403);
    }
    if (body.status !== "in_progress" || !["assigned", "revision_requested"].includes(task.status)) {
      throw new AuthorizationError("You cannot change this task.", 403);
    }
    const { error } = await db.from("tasks").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new DataAccessError("Unable to update the task.", 500);
    return;
  }
  if (!canManageTasks(profile)) throw new AuthorizationError("You do not have access to this resource.", 403);
  if (!isProgrammeWideRole(profile.role)) requireDepartmentScope(profile, task.department_id);
  if (task.status === "approved" && body.status && body.status !== "approved") {
    throw new DataAccessError("Approved work cannot be reopened this way.", 409);
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 160);
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 4000);
  if (typeof body.instructions === "string") patch.instructions = body.instructions.trim().slice(0, 4000);
  if (typeof body.acceptanceCriteria === "string") patch.acceptance_criteria = body.acceptanceCriteria.trim().slice(0, 4000);
  if (typeof body.priority === "string" && PRIORITIES.includes(body.priority as (typeof PRIORITIES)[number])) patch.priority = body.priority;
  if (typeof body.dueAt === "string" && !Number.isNaN(Date.parse(body.dueAt))) patch.due_at = new Date(body.dueAt).toISOString();
  if (typeof body.status === "string" && body.status === "cancelled") patch.status = "cancelled";
  const { error } = await db.from("tasks").update(patch).eq("id", id);
  if (error) throw new DataAccessError("Unable to update the task.", 500);
  await recordSensitiveAudit({ actor: profile, action: "task_updated", targetType: "task", targetId: id });
}

export async function submitTaskWork(profile: TrustedProfile, body: Record<string, unknown>) {
  if (profile.role !== "intern") throw new AuthorizationError("Intern authorization is required.", 403);
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const url = typeof body.deliverableUrl === "string" ? body.deliverableUrl.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  if (!taskId) throw new DataAccessError("A task is required.", 400);
  if (!/^https?:\/\//i.test(url) || url.length < 10) throw new DataAccessError("A valid deliverable URL is required.", 400);
  const db = privilegedDatabase();
  const { data: task } = await db.from("tasks").select("id, department_id, assigned_to_profile_id, status, created_by_profile_id, title").eq("id", taskId).maybeSingle();
  if (!task) throw new DataAccessError("Task not found.", 404);
  if (!internCanSee(profile, task.department_id, task.assigned_to_profile_id)) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
  if (task.status === "approved" || task.status === "cancelled") throw new DataAccessError("This task cannot be submitted.", 409);
  const { error } = await db.from("task_submissions").upsert(
    {
      task_id: taskId,
      intern_profile_id: profile.id,
      deliverable_url: url.slice(0, 500),
      notes: notes || null,
      submitted_at: new Date().toISOString(),
      review_status: "pending",
      reviewer_profile_id: null,
      review_feedback: null,
      reviewed_at: null,
    },
    { onConflict: "task_id,intern_profile_id" },
  );
  if (error) throw new DataAccessError("Unable to submit the task.", 500);
  if (task.assigned_to_profile_id) {
    await db.from("tasks").update({ status: "submitted", updated_at: new Date().toISOString() }).eq("id", taskId);
  }
  await notifyUnique({
    recipientProfileId: task.created_by_profile_id,
    title: "Task submitted",
    message: `${profile.first_name} submitted ${task.title}`,
    type: "task",
    link: "/manager",
    sourceType: "task_submitted",
    sourceId: taskId,
  });
  await recordSensitiveAudit({ actor: profile, action: "task_submitted", targetType: "task", targetId: taskId });
}

export async function reviewTask(profile: TrustedProfile, body: Record<string, unknown>) {
  if (!canManageTasks(profile)) throw new AuthorizationError("You do not have access to this resource.", 403);
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const internId = typeof body.internProfileId === "string" ? body.internProfileId : "";
  const decision = body.decision;
  const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 2000) : "";
  if (!taskId) throw new DataAccessError("A task is required.", 400);
  if (decision !== "approved" && decision !== "revision_requested" && decision !== "rejected") {
    throw new DataAccessError("The review decision is invalid.", 400);
  }
  if (decision !== "approved" && !feedback) throw new DataAccessError("Review feedback is required.", 400);
  const db = privilegedDatabase();
  const { data: task } = await db.from("tasks").select("id, department_id, assigned_to_profile_id, title").eq("id", taskId).maybeSingle();
  if (!task) throw new DataAccessError("Task not found.", 404);
  if (!isProgrammeWideRole(profile.role)) requireDepartmentScope(profile, task.department_id);
  const targetIntern = internId || task.assigned_to_profile_id;
  if (!targetIntern) throw new DataAccessError("An intern submission is required.", 400);
  const { data: submission } = await db
    .from("task_submissions")
    .select("id, intern_profile_id")
    .eq("task_id", taskId)
    .eq("intern_profile_id", targetIntern)
    .maybeSingle();
  if (!submission) throw new DataAccessError("A submission is required before review.", 409);
  const { error } = await db
    .from("task_submissions")
    .update({
      review_status: decision,
      reviewer_profile_id: profile.id,
      review_feedback: feedback || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submission.id);
  if (error) throw new DataAccessError("Unable to record the review.", 500);
  if (task.assigned_to_profile_id) {
    await db.from("tasks").update({ status: decision === "revision_requested" ? "revision_requested" : decision, updated_at: new Date().toISOString() }).eq("id", taskId);
  }
  await notifyUnique({
    recipientProfileId: submission.intern_profile_id,
    title: "Task review update",
    message: `${task.title} was ${decision.replace("_", " ")}.`,
    type: "task",
    link: "/portal",
    sourceType: "task_reviewed",
    sourceId: submission.id,
  });
  await recordSensitiveAudit({ actor: profile, action: "task_reviewed", targetType: "task", targetId: taskId, metadata: { decision } });
}

export async function addTaskComment(profile: TrustedProfile, body: Record<string, unknown>) {
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const parentCommentId = typeof body.parentCommentId === "string" ? body.parentCommentId : null;
  if (!taskId || !message) throw new DataAccessError("A comment is required.", 400);
  const db = privilegedDatabase();
  const { data: task } = await db.from("tasks").select("id, department_id, assigned_to_profile_id, created_by_profile_id, title").eq("id", taskId).maybeSingle();
  if (!task) throw new DataAccessError("Task not found.", 404);
  const allowed =
    (profile.role === "intern" && internCanSee(profile, task.department_id, task.assigned_to_profile_id)) ||
    (canManageTasks(profile) && (isProgrammeWideRole(profile.role) || task.department_id === profile.department_id));
  if (!allowed) throw new AuthorizationError("You do not have access to this resource.", 403);
  let parentAuthorId: string | null = null;
  if (parentCommentId) {
    const { data: parent } = await db
      .from("task_comments")
      .select("id, task_id, author_profile_id")
      .eq("id", parentCommentId)
      .maybeSingle();
    if (!parent || parent.task_id !== taskId) throw new DataAccessError("The reply target is invalid.", 400);
    parentAuthorId = parent.author_profile_id;
  }
  const insertPayload: Record<string, unknown> = { task_id: taskId, author_profile_id: profile.id, message };
  if (parentCommentId) insertPayload.parent_comment_id = parentCommentId;
  const { data: comment, error } = await db
    .from("task_comments")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !comment) {
    if (parentCommentId && missingReplyColumn(error)) throw new DataAccessError("Replies are unavailable until the approved reply migration is applied.", 503);
    throw new DataAccessError("Unable to add the comment.", 500);
  }
  const recipient = parentAuthorId && parentAuthorId !== profile.id
    ? parentAuthorId
    : profile.id === task.created_by_profile_id ? task.assigned_to_profile_id : task.created_by_profile_id;
  if (recipient) {
    await notifyUnique({
      recipientProfileId: recipient,
      title: `Comment on ${task.title}`,
      message: message.slice(0, 120),
      type: "task",
      sourceType: "task_comment",
      sourceId: comment.id,
    });
  }
  return {
    id: comment.id,
    parentCommentId,
    authorName: `${profile.first_name} ${profile.surname}`.trim(),
    message,
    createdAt: new Date().toISOString(),
  };
}
