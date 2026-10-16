import "server-only";

import { AuthorizationError, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { recordSensitiveAudit } from "@/lib/data/audit";

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function requireAdmin(profile: TrustedProfile) {
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
}

export async function listDepartments(profile: TrustedProfile) {
  if (!["admin", "super_admin", "lead", "manager"].includes(profile.role)) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
  const db = privilegedDatabase();
  const [{ data: departments, error }, { data: profiles }] = await Promise.all([
    db.from("departments").select("id, name, slug, description, is_active, created_at").order("name"),
    db.from("profiles").select("id, first_name, surname, role, is_active, department_id"),
  ]);
  if (error) throw new DataAccessError("Unable to load departments.", 500);
  const rows = departments ?? [];
  const people = profiles ?? [];
  return rows
    .filter((department) => profile.role === "admin" || profile.role === "super_admin" || department.id === profile.department_id)
    .map((department) => ({
      id: department.id,
      name: department.name,
      slug: department.slug,
      description: department.description,
      isActive: department.is_active,
      internCount: people.filter((person) => person.department_id === department.id && person.role === "intern" && person.is_active).length,
      staffCount: people.filter((person) => person.department_id === department.id && person.role !== "intern" && person.is_active).length,
      leads: people
        .filter(
          (person) =>
            person.department_id === department.id &&
            person.is_active &&
            (person.role === "lead" || person.role === "manager"),
        )
        .map((person) => `${person.first_name} ${person.surname}`),
    }));
}

export async function createDepartment(profile: TrustedProfile, body: Record<string, unknown>) {
  requireAdmin(profile);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 400) : "";
  if (name.length < 3) throw new DataAccessError("A department name is required.", 400);
  const slug = slugFromName(name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new DataAccessError("The department name is invalid.", 400);
  const { data, error } = await privilegedDatabase()
    .from("departments")
    .insert({ name, slug, description: description || null, is_active: true })
    .select("id")
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new DataAccessError("A department with that name already exists.", 409);
    throw new DataAccessError("Unable to create the department.", 500);
  }
  await recordSensitiveAudit({
    actor: profile,
    action: "department_created",
    targetType: "department",
    targetId: data.id,
    metadata: { slug },
  });
  return { id: data.id };
}

export async function updateDepartment(profile: TrustedProfile, departmentId: string, body: Record<string, unknown>) {
  requireAdmin(profile);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 120);
    if (name.length < 3) throw new DataAccessError("A department name is required.", 400);
    patch.name = name;
    patch.slug = slugFromName(name);
  }
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 400) || null;
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
  const { error } = await privilegedDatabase().from("departments").update(patch).eq("id", departmentId);
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new DataAccessError("A department with that name already exists.", 409);
    throw new DataAccessError("Unable to update the department.", 500);
  }
  await recordSensitiveAudit({
    actor: profile,
    action: "department_updated",
    targetType: "department",
    targetId: departmentId,
  });
}
