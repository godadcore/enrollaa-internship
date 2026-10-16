"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconPlus, IconTasks } from "@/components/icons";
import { CustomDatePicker, CustomSelect, EmptyState, Modal, StatusBadge, TabBar, Toast } from "@/components/ui";
import { formatInWAT } from "@/lib/date-utils";
import { OperationalTaskModal, type OperationalTask } from "@/components/operations/OperationalTaskModal";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

export function TasksPanel({ mode }: { mode: "intern" | "staff" }) {
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [interns, setInterns] = useState<{ id: string; firstName: string; surname: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<OperationalTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", instructions: "", acceptanceCriteria: "", assignedToProfileId: "all", departmentId: "", priority: "medium", dueAt: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    try {
      const [taskResponse, staffResponse, departmentResponse] = await Promise.all([
        fetch("/api/tasks", { cache: "no-store" }),
        mode === "staff" ? fetch("/api/staff", { cache: "no-store" }) : Promise.resolve(null),
        mode === "staff" ? fetch("/api/departments", { cache: "no-store" }) : Promise.resolve(null),
      ]);
      const taskData = await taskResponse.json();
      if (ticket.stale()) return;
      if (!taskResponse.ok || !taskData.success) throw new Error(taskData.error || "Unable to load tasks.");
      setTasks(asList<OperationalTask>(taskData.tasks));
      if (staffResponse) {
        const staffData = await staffResponse.json();
        if (staffResponse.ok && staffData.success) {
          setInterns(asList<{ id: string; role: string; firstName: string; surname: string }>(staffData.staff).filter((row) => row.role === "intern"));
        }
      }
      if (departmentResponse) {
        const departmentData = await departmentResponse.json();
        if (departmentResponse.ok && departmentData.success) setDepartments(asList(departmentData.departments));
      }
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load tasks.");
      setTasks([]);
    } finally {
      if (!ticket.stale()) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [mode]);

  const filtered = filter === "all" ? tasks : tasks.filter((task) => task.status === filter);

  async function create() {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        dueAt: form.dueAt,
        assignedToProfileId: form.assignedToProfileId,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setToast({ message: data.error || "Unable to create the task.", type: "error" });
      return;
    }
    setCreateOpen(false);
    setToast({ message: "Task created.", type: "success" });
    await load();
  }

  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <Toast message={toast?.message || ""} type={toast?.type || "success"} visible={!!toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-bold text-white">{mode === "intern" ? "My tasks" : "Tasks"}</h2>
        {mode === "staff" ? (
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setCreateOpen(true)}>
            <IconPlus size={14} /> Create task
          </button>
        ) : null}
      </div>
      <TabBar
        tabs={[
          { id: "all", label: "All", count: tasks.length },
          { id: "assigned", label: "Assigned", count: tasks.filter((task) => task.status === "assigned" || task.status === "in_progress").length },
          { id: "submitted", label: "Submitted", count: tasks.filter((task) => task.status === "submitted").length },
          { id: "approved", label: "Approved", count: tasks.filter((task) => task.status === "approved").length },
        ]}
        activeTab={filter}
        onChange={setFilter}
      />
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading tasks…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Tasks unavailable" description={error} /> : null}
      {!loading && !error && filtered.length === 0 ? <EmptyState icon={<IconTasks size={28} />} title="No tasks" description="Assigned work will appear here." /> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((task) => (
          <button key={task.id} type="button" onClick={() => setSelected(task)} className="glass-card p-4 text-left space-y-2 min-w-0">
            <div className="flex justify-between gap-2">
              <h3 className="font-heading text-sm font-bold text-white break-words">{task.title}</h3>
              <StatusBadge status={task.status} />
            </div>
            <p className="text-xs text-enrollaa-muted-light line-clamp-2 break-words">{task.description}</p>
            <p className="text-xs text-enrollaa-muted-light">Due {formatInWAT(task.dueAt, { month: "short", day: "numeric" })} · {task.assignedToName}</p>
          </button>
        ))}
      </div>
      <OperationalTaskModal task={selected} onClose={() => setSelected(null)} onUpdated={() => void load()} mode={mode} />
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create task">
        <div className="space-y-3 min-w-0">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          {departments.length > 1 ? (
            <CustomSelect value={form.departmentId} onChange={(value) => setForm({ ...form, departmentId: value })} options={[{ value: "", label: "Select department" }, ...departments.map((department) => ({ value: department.id, label: department.name }))]} />
          ) : null}
          <CustomSelect
            value={form.assignedToProfileId}
            onChange={(value) => setForm({ ...form, assignedToProfileId: value })}
            options={[{ value: "all", label: "All department interns" }, ...interns.map((intern) => ({ value: intern.id, label: `${intern.firstName} ${intern.surname}` }))]}
          />
          <CustomSelect value={form.priority} onChange={(value) => setForm({ ...form, priority: value })} options={["low", "medium", "high", "urgent"].map((value) => ({ value, label: value }))} />
          <CustomDatePicker value={form.dueAt} onChange={(value) => setForm({ ...form, dueAt: value })} />
          <button type="button" className="btn-primary w-full" onClick={() => void create()}>Save task</button>
        </div>
      </Modal>
    </div>
  );
}
