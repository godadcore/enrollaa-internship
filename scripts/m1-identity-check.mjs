import assert from "node:assert/strict";

const IDENTITY_KEYS = [
  "id",
  "email",
  "role",
  "first_name",
  "surname",
  "role_title",
  "department",
  "department_id",
  "is_active",
  "created_at",
];

function applyTrustedIdentity(source, trusted) {
  return {
    ...(source ?? {}),
    ...trusted,
    id: trusted.id,
    email: trusted.email,
    role: trusted.role,
    first_name: trusted.first_name,
    surname: trusted.surname,
    role_title: trusted.role_title,
    department: trusted.department,
    department_id: trusted.department_id ?? null,
    is_active: trusted.is_active,
    created_at: trusted.created_at,
  };
}

function publicProfileUpdates(updates) {
  const next = { ...updates };
  for (const key of IDENTITY_KEYS) delete next[key];
  return next;
}

const trusted = {
  id: "profile-admin",
  email: "admin@enrollaa.com.ng",
  role: "admin",
  first_name: "Ada",
  surname: "Admin",
  role_title: "Administrator",
  department_id: "dept-frontend",
  department: "Frontend Engineering",
  is_active: true,
  created_at: "2026-10-01T00:00:00.000Z",
};

const seeded = {
  id: "user-admin-1",
  email: "seed@example.com",
  role: "intern",
  phone: "08000000000",
};

const locked = applyTrustedIdentity(seeded, trusted);
assert.equal(locked.id, trusted.id);
assert.equal(locked.role, "admin");
assert.equal(locked.phone, "08000000000");

const stripped = publicProfileUpdates({ role: "super_admin", email: "x@y.z", phone: "1", bio: "ok" });
assert.equal(stripped.role, undefined);
assert.equal(stripped.email, undefined);
assert.equal(stripped.phone, "1");

console.log("m1 identity lock checks passed");
