"use client";

import React, { useEffect, useMemo, useState } from "react";
import { IconAlertCircle, IconUsers } from "@/components/icons";
import { CustomSelect, EmptyState, Modal, StatusBadge, Toast } from "@/components/ui";
import { internshipRoleSelectOptions } from "@/lib/internship-roles";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

type StaffRow = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  surname: string;
  roleTitle: string;
  departmentId: string | null;
  department: string | null;
  isActive: boolean;
  isDepartmentLead: boolean;
};

type DepartmentOption = { id: string; name: string };

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "lead", label: "Lead" },
  { value: "manager", label: "Manager" },
  { value: "intern", label: "Intern" },
];

export function StaffManagementPanel() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [role, setRole] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [assignLead, setAssignLead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    try {
      const [staffResponse, departmentResponse] = await Promise.all([
        fetch("/api/staff", { cache: "no-store" }),
        fetch("/api/departments", { cache: "no-store" }),
      ]);
      const staffData = await staffResponse.json();
      const departmentData = await departmentResponse.json();
      if (ticket.stale()) return;
      if (!staffResponse.ok || !staffData.success) throw new Error(staffData.error || "Unable to load staff.");
      if (!departmentResponse.ok || !departmentData.success) throw new Error(departmentData.error || "Unable to load departments.");
      setStaff(asList<StaffRow>(staffData.staff));
      setDepartments(asList<{ id: string; name: string }>(departmentData.departments).map((row) => ({ id: row.id, name: row.name })));
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load staff.");
      setStaff([]);
    } finally {
      if (!ticket.stale()) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      staff.filter((row) => {
        const matchRole = roleFilter === "all" || row.role === roleFilter;
        const matchDepartment = departmentFilter === "all" || row.departmentId === departmentFilter;
        const matchStatus =
          statusFilter === "all" || (statusFilter === "active" ? row.isActive : !row.isActive);
        return matchRole && matchDepartment && matchStatus;
      }),
    [staff, roleFilter, departmentFilter, statusFilter],
  );

  function open(row: StaffRow) {
    setSelected(row);
    setRole(row.role);
    setDepartmentId(row.departmentId || "");
    setRoleTitle(row.roleTitle);
    setIsActive(row.isActive);
    setAssignLead(row.isDepartmentLead);
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          role,
          departmentId: departmentId || null,
          roleTitle,
          isActive,
          assignLead,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to update staff.");
      setToast({ message: "Staff record updated.", type: "success" });
      setSelected(null);
      await load();
    } catch (saveError) {
      setToast({ message: saveError instanceof Error ? saveError.message : "Unable to update staff.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <Toast message={toast?.message || ""} type={toast?.type || "success"} visible={!!toast} />
      <div>
        <h2 className="font-heading text-xl font-bold text-white">Staff</h2>
        <p className="mt-1 text-sm text-enrollaa-muted-light">Trusted profiles, department assignments, and department-lead relationships.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 min-w-0">
        <CustomSelect value={roleFilter} onChange={setRoleFilter} options={ROLE_OPTIONS} />
        <CustomSelect
          value={departmentFilter}
          onChange={setDepartmentFilter}
          options={[{ value: "all", label: "All departments" }, ...departments.map((department) => ({ value: department.id, label: department.name }))]}
        />
        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading staff…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Staff unavailable" description={error} /> : null}
      {!loading && !error && filtered.length === 0 ? (
        <EmptyState icon={<IconUsers size={28} />} title="No staff records" description="Staff profiles from the database will appear here." />
      ) : null}
      <div className="space-y-3">
        {filtered.map((row) => (
          <button key={row.id} type="button" onClick={() => open(row)} className="w-full glass-card p-3 text-left space-y-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-white break-words">{row.firstName} {row.surname}</span>
              <StatusBadge status={row.isActive ? "active" : "inactive"} />
            </div>
            <p className="text-xs text-enrollaa-muted-light break-all">{row.email}</p>
            <p className="text-xs text-enrollaa-muted-light break-words">
              {row.role} · {row.department || "No department"} {row.isDepartmentLead ? "· department lead" : ""}
            </p>
          </button>
        ))}
      </div>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Staff assignment">
        <div className="space-y-3 min-w-0">
          <label className="space-y-1.5 block">
            <span className="label-text">{role === "intern" ? "Internship role" : "Role title"}</span>
            {role === "intern" ? (
              <CustomSelect value={roleTitle} onChange={setRoleTitle} options={internshipRoleSelectOptions(roleTitle)} />
            ) : (
              <input value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
            )}
          </label>
          <div className="space-y-1.5">
            <span className="label-text">Account role</span>
            <CustomSelect value={role} onChange={setRole} options={ROLE_OPTIONS.filter((option) => option.value !== "all")} />
          </div>
          <div className="space-y-1.5">
            <span className="label-text">Department</span>
            <CustomSelect
              value={departmentId}
              onChange={setDepartmentId}
              options={[{ value: "", label: "Unassigned" }, ...departments.map((department) => ({ value: department.id, label: department.name }))]}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Account is active
          </label>
          <label className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={assignLead} onChange={(event) => setAssignLead(event.target.checked)} />
            Assign as department lead
          </label>
          <button type="button" disabled={busy} className="btn-primary w-full" onClick={() => void save()}>
            {busy ? "Saving…" : "Save assignment"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
