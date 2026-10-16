"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconPlus, IconUsers } from "@/components/icons";
import { EmptyState, Modal, Toast } from "@/components/ui";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

type DepartmentRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  internCount: number;
  staffCount: number;
  leads: string[];
};

export function DepartmentsManagementPanel() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/departments", { cache: "no-store" });
      const data = await response.json();
      if (ticket.stale()) return;
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load departments.");
      setDepartments(asList<DepartmentRow>(data.departments));
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load departments.");
      setDepartments([]);
    } finally {
      if (!ticket.stale()) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setOpen(true);
  }

  function startEdit(department: DepartmentRow) {
    setEditing(department);
    setName(department.name);
    setDescription(department.description || "");
    setIsActive(department.isActive);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/departments", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, name, description, isActive } : { name, description }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save the department.");
      setToast({ message: editing ? "Department updated." : "Department created.", type: "success" });
      setOpen(false);
      await load();
    } catch (saveError) {
      setToast({ message: saveError instanceof Error ? saveError.message : "Unable to save the department.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <Toast message={toast?.message || ""} type={toast?.type || "success"} visible={!!toast} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-bold text-white">Departments</h2>
          <p className="mt-1 text-sm text-enrollaa-muted-light">Create and edit departments. Historical records are kept when a department is made inactive.</p>
        </div>
        <button type="button" className="btn-primary inline-flex items-center justify-center gap-2" onClick={startCreate}>
          <IconPlus size={16} /> New department
        </button>
      </div>
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading departments…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Departments unavailable" description={error} /> : null}
      {!loading && !error && departments.length === 0 ? (
        <EmptyState icon={<IconUsers size={28} />} title="No departments" description="Create a department to assign staff and interns." />
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {departments.map((department) => (
          <article key={department.id} className="glass-card space-y-3 p-4 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h3 className="break-words font-heading text-sm font-bold text-white">{department.name}</h3>
              <span className={department.isActive ? "badge-green shrink-0" : "badge-muted shrink-0"}>
                {department.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            {department.description ? <p className="text-xs text-enrollaa-muted-light break-words">{department.description}</p> : null}
            <p className="text-xs text-enrollaa-muted-light">
              {department.staffCount} staff · {department.internCount} interns
            </p>
            <p className="text-xs text-enrollaa-muted-light break-words">
              Lead: {department.leads.length ? department.leads.join(", ") : "Unassigned"}
            </p>
            <button type="button" className="btn-ghost text-xs" onClick={() => startEdit(department)}>Edit</button>
          </article>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit department" : "Create department"}>
        <div className="space-y-3 min-w-0">
          <label className="space-y-1.5 block">
            <span className="label-text">Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          </label>
          <label className="space-y-1.5 block">
            <span className="label-text">Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          </label>
          {editing ? (
            <label className="flex items-center gap-2 text-sm text-white">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Department is active
            </label>
          ) : null}
          <button type="button" disabled={busy} className="btn-primary w-full" onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
