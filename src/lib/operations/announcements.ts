import "server-only";

import { AuthorizationError, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { isProgrammeWideRole } from "@/lib/data/scope";
import { recordSensitiveAudit } from "@/lib/data/audit";
import { notifyUnique } from "@/lib/operations/notify";

function canPublish(profile: TrustedProfile) {
  return ["admin", "super_admin", "lead", "manager"].includes(profile.role);
}

function visibleTo(profile: TrustedProfile, row: { audience_type: string; audience_role: string | null; audience_department_id: string | null; status: string; expires_at: string | null }) {
  if (row.status !== "published") return isProgrammeWideRole(profile.role) || (canPublish(profile) && row.audience_department_id === profile.department_id);
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return false;
  if (row.audience_type === "all") return true;
  if (row.audience_type === "role") return row.audience_role === profile.role || (row.audience_role === "lead" && profile.role === "manager") || (row.audience_role === "managers" && (profile.role === "lead" || profile.role === "manager"));
  if (row.audience_type === "department") return profile.department_id === row.audience_department_id || isProgrammeWideRole(profile.role);
  return false;
}

export async function listAnnouncements(profile: TrustedProfile) {
  const { data, error } = await privilegedDatabase()
    .from("announcements")
    .select("id, title, content, audience_type, audience_role, audience_department_id, status, created_at, published_at, expires_at, departments(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new DataAccessError("Unable to load announcements.", 500);
  return (data ?? [])
    .filter((row) => visibleTo(profile, row))
    .map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      audienceType: row.audience_type,
      audienceRole: row.audience_role,
      audienceDepartmentId: row.audience_department_id,
      department: Array.isArray(row.departments) ? row.departments[0]?.name : (row.departments as { name?: string } | null)?.name,
      status: row.status,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      expiresAt: row.expires_at,
    }));
}

export async function createAnnouncement(profile: TrustedProfile, body: Record<string, unknown>) {
  if (!canPublish(profile)) throw new AuthorizationError("You do not have access to this resource.", 403);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 4000) : "";
  if (title.length < 3 || content.length < 3) throw new DataAccessError("A title and message are required.", 400);
  const target = typeof body.target === "string" ? body.target : "all";
  let audienceType = "all";
  let audienceRole: string | null = null;
  let audienceDepartmentId: string | null = null;
  if (target === "interns" || target === "intern") {
    audienceType = "role";
    audienceRole = "intern";
  } else if (target === "managers" || target === "leads" || target === "lead" || target === "manager") {
    audienceType = "role";
    audienceRole = "lead";
  } else if (target !== "all") {
    audienceType = "department";
    audienceDepartmentId = target;
    if (!isProgrammeWideRole(profile.role) && audienceDepartmentId !== profile.department_id) {
      throw new AuthorizationError("You do not have access to this department.", 403);
    }
  }
  if (!isProgrammeWideRole(profile.role) && audienceType === "all") {
    audienceType = "department";
    audienceDepartmentId = profile.department_id;
    if (!audienceDepartmentId) throw new DataAccessError("A department is required.", 400);
  }
  const { data, error } = await privilegedDatabase()
    .from("announcements")
    .insert({
      title,
      content,
      audience_type: audienceType,
      audience_role: audienceRole,
      audience_department_id: audienceDepartmentId,
      status: "published",
      created_by_profile_id: profile.id,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new DataAccessError("Unable to publish the announcement.", 500);
  let recipients = privilegedDatabase().from("profiles").select("id, role, department_id").eq("is_active", true);
  const { data: people } = await recipients;
  const matches = (people ?? []).filter((person) => {
    if (audienceType === "all") return true;
    if (audienceType === "role") return person.role === audienceRole || (audienceRole === "lead" && (person.role === "lead" || person.role === "manager"));
    return person.department_id === audienceDepartmentId;
  });
  for (const person of matches) {
    await notifyUnique({
      recipientProfileId: person.id,
      title,
      message: content.slice(0, 180),
      type: "announcement",
      sourceType: "announcement",
      sourceId: data.id,
    });
  }
  await recordSensitiveAudit({ actor: profile, action: "announcement_published", targetType: "announcement", targetId: data.id });
  return { id: data.id };
}

export async function archiveAnnouncement(profile: TrustedProfile, id: string) {
  if (!isProgrammeWideRole(profile.role)) throw new AuthorizationError("You do not have access to this resource.", 403);
  const { error } = await privilegedDatabase()
    .from("announcements")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new DataAccessError("Unable to archive the announcement.", 500);
}

export async function listNotifications(profile: TrustedProfile) {
  const { data, error } = await privilegedDatabase()
    .from("notifications")
    .select("id, title, message, notification_type, link, read_at, created_at")
    .eq("recipient_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new DataAccessError("Unable to load notifications.", 500);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.notification_type,
    link: row.link,
    read: Boolean(row.read_at),
    createdAt: row.created_at,
  }));
}

export async function markNotificationRead(profile: TrustedProfile, id: string, all = false) {
  const db = privilegedDatabase();
  if (all) {
    await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_profile_id", profile.id).is("read_at", null);
    return;
  }
  const { data } = await db.from("notifications").select("id, recipient_profile_id").eq("id", id).maybeSingle();
  if (!data || data.recipient_profile_id !== profile.id) throw new DataAccessError("Notification not found.", 404);
  await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}
