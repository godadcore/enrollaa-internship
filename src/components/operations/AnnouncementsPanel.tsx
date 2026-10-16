"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconBell, IconPlus } from "@/components/icons";
import { CustomSelect, EmptyState, Modal, Toast } from "@/components/ui";
import { formatInWAT } from "@/lib/date-utils";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

export function AnnouncementsPanel({ canPublish }: { canPublish: boolean }) {
  const [items, setItems] = useState<{ id: string; title: string; content: string; audienceType: string; status: string; createdAt: string; department?: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [target, setTarget] = useState("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    try {
      const [announcementResponse, departmentResponse] = await Promise.all([
        fetch("/api/announcements", { cache: "no-store" }),
        canPublish ? fetch("/api/departments", { cache: "no-store" }) : Promise.resolve(null),
      ]);
      const data = await announcementResponse.json();
      if (ticket.stale()) return;
      if (!announcementResponse.ok || !data.success) throw new Error(data.error || "Unable to load announcements.");
      setItems(asList(data.announcements));
      if (departmentResponse) {
        const departmentData = await departmentResponse.json();
        if (departmentResponse.ok && departmentData.success) setDepartments(asList(departmentData.departments));
      }
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load announcements.");
      setItems([]);
    } finally {
      if (!ticket.stale()) setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [canPublish]);

  async function publish() {
    const response = await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content, target }) });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setToast({ message: data.error || "Unable to publish.", type: "error" });
      return;
    }
    setOpen(false);
    setTitle("");
    setContent("");
    setToast({ message: "Announcement published.", type: "success" });
    await load();
  }

  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <Toast message={toast?.message || ""} type={toast?.type || "success"} visible={!!toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-bold text-white">Announcements</h2>
        {canPublish ? <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setOpen(true)}><IconPlus size={14} /> Publish</button> : null}
      </div>
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading announcements…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Announcements unavailable" description={error} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState icon={<IconBell size={28} />} title="No announcements" description="Published notices will appear here." /> : null}
      {items.map((item) => (
        <article key={item.id} className="glass-card p-4 space-y-2 min-w-0">
          <h3 className="font-heading text-sm font-bold text-white break-words">{item.title}</h3>
          <p className="text-sm text-enrollaa-muted-light break-words">{item.content}</p>
          <p className="text-[10px] text-enrollaa-muted-light">{item.audienceType}{item.department ? ` · ${item.department}` : ""} · {formatInWAT(item.createdAt, { month: "short", day: "numeric" })}</p>
        </article>
      ))}
      <Modal open={open} onClose={() => setOpen(false)} title="Publish announcement">
        <div className="space-y-3 min-w-0">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Message" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <CustomSelect
            value={target}
            onChange={setTarget}
            options={[{ value: "all", label: "Everyone" }, { value: "interns", label: "Interns" }, { value: "leads", label: "Leads and managers" }, ...departments.map((department) => ({ value: department.id, label: department.name }))]}
          />
          <button type="button" className="btn-primary w-full" onClick={() => void publish()}>Publish</button>
        </div>
      </Modal>
    </div>
  );
}
