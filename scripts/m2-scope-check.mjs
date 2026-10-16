function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const programmeWide = new Set(["admin", "super_admin"]);

function assignedDepartmentId(profile) {
  if (!profile.department_id) throw new Error("no-department");
  return profile.department_id;
}

function requireDepartmentScope(profile, requestedDepartmentId) {
  if (typeof requestedDepartmentId !== "string" || !requestedDepartmentId) throw new Error("required");
  if (programmeWide.has(profile.role)) return requestedDepartmentId;
  const assigned = assignedDepartmentId(profile);
  if (assigned !== requestedDepartmentId) throw new Error("forbidden");
  return assigned;
}

const lead = { role: "lead", department_id: "dept-a" };
expect(requireDepartmentScope(lead, "dept-a") === "dept-a", "lead may access assigned department");
try {
  requireDepartmentScope(lead, "dept-b");
  throw new Error("lead must not access another department");
} catch (error) {
  expect(error.message === "forbidden", "cross-department must be forbidden");
}

const intern = { role: "intern", department_id: "dept-a" };
try {
  requireDepartmentScope(intern, "dept-b");
  throw new Error("intern must not choose another department");
} catch (error) {
  expect(error.message === "forbidden", "intern cannot supply a different department id");
}

const admin = { role: "admin", department_id: null };
expect(requireDepartmentScope(admin, "dept-b") === "dept-b", "admin may operate across departments after server auth");

const unassigned = { role: "manager", department_id: null };
try {
  requireDepartmentScope(unassigned, "dept-a");
  throw new Error("unassigned manager must not pass");
} catch (error) {
  expect(error.message === "no-department", "unassigned non-admin cannot scope a department");
}

console.log("m2 department-scope checks passed");
