"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconCalendar, IconCheckCircle, IconClock, IconTrendingUp } from "@/components/icons";
import { DataTable, EmptyState, Modal, StatCard, StatusBadge, Toast } from "@/components/ui";
import { formatInWAT } from "@/lib/date-utils";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

type RecordRow = {
  id: string;
  internName: string;
  department: string;
  internProfileId: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  punctualityScore: number;
};

export function AttendancePanel({ mode }: { mode: "intern" | "staff" }) {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [status, setStatus] = useState("excused");
  const [reason, setReason] = useState("");
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/attendance", { cache: "no-store" });
      const data = await response.json();
      if (ticket.stale()) return;
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load attendance.");
      setRecords(asList<RecordRow>(data.records));
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load attendance.");
      setRecords([]);
    } finally {
      if (!ticket.stale()) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const mineToday = records.find((row) => row.date === today);
  const onTime = records.filter((row) => row.status === "on_time").length;

  async function action(kind: "checkin" | "checkout") {
    setBusy(true);
    try {
      const response = await fetch("/api/attendance", {
        method: kind === "checkin" ? "POST" : "PATCH",
        headers: kind === "checkout" ? { "Content-Type": "application/json" } : undefined,
        body: kind === "checkout" ? JSON.stringify({ action: "checkout" }) : undefined,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to update attendance.");
      setToast({ message: data.message || (kind === "checkin" ? "Checked in." : "Checked out."), type: "success" });
      await load();
    } catch (actionError) {
      setToast({ message: actionError instanceof Error ? actionError.message : "Unable to update attendance.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function correct() {
    if (!correctId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: correctId, status, reason }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to correct attendance.");
      setToast({ message: "Attendance corrected.", type: "success" });
      setCorrectId(null);
      await load();
    } catch (correctError) {
      setToast({ message: correctError instanceof Error ? correctError.message : "Unable to correct attendance.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <Toast message={toast?.message || ""} type={toast?.type || "success"} visible={!!toast} />
      {mode === "intern" ? (
        <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-bold text-white">Daily attendance</h2>
            <p className="text-xs text-enrollaa-muted-light mt-1 break-words">On time until 9:15 AM WAT. Later check-ins are recorded as late.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {mineToday?.checkInAt ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-enrollaa-green/15 text-enrollaa-green text-xs font-heading font-bold">
                <IconCheckCircle size={16} /> Checked in
              </span>
            ) : (
              <button type="button" disabled={busy} className="btn-primary" onClick={() => void action("checkin")}>{busy ? "Recording…" : "Check in now"}</button>
            )}
            {mineToday?.checkInAt && !mineToday.checkOutAt ? (
              <button type="button" disabled={busy} className="btn-ghost" onClick={() => void action("checkout")}>Check out</button>
            ) : null}
          </div>
        </div>
      ) : (
        <h2 className="font-heading text-xl font-bold text-white">Attendance</h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Records" value={records.length} icon={<IconCalendar size={18} />} color="purple" />
        <StatCard label="On time" value={onTime} icon={<IconTrendingUp size={18} />} color="green" />
        <StatCard label="Late" value={records.filter((row) => row.status === "late").length} icon={<IconClock size={18} />} color="amber" />
      </div>
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading attendance…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Attendance unavailable" description={error} /> : null}
      {!loading && !error && records.length === 0 ? <EmptyState icon={<IconCalendar size={28} />} title="No attendance records" description="Check-ins will appear here." /> : null}
      <div className="space-y-3 md:hidden">
        {records.map((row) => (
          <article key={row.id} className="glass-card p-3 space-y-1 min-w-0">
            <div className="flex justify-between gap-2">
              <span className="text-sm text-white break-words">{mode === "intern" ? row.date : row.internName}</span>
              <StatusBadge status={row.status} />
            </div>
            <p className="text-xs text-enrollaa-muted-light break-words">{row.department} · {row.checkInAt ? formatInWAT(row.checkInAt, { hour: "2-digit", minute: "2-digit" }) : "No check-in"}</p>
            {mode === "staff" ? <button type="button" className="btn-ghost text-xs" onClick={() => { setCorrectId(row.id); setReason(""); }}>Correct</button> : null}
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        {records.length ? (
          <DataTable headers={mode === "intern" ? ["Date", "Check-in", "Check-out", "Status", "Score"] : ["Intern", "Department", "Date", "Status", "Score", ""]}>
            {records.map((row) => (
              <tr key={row.id}>
                {mode === "intern" ? (
                  <>
                    <td className="table-cell text-white text-xs">{row.date}</td>
                    <td className="table-cell text-xs">{row.checkInAt ? formatInWAT(row.checkInAt, { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="table-cell text-xs">{row.checkOutAt ? formatInWAT(row.checkOutAt, { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="table-cell"><StatusBadge status={row.status} /></td>
                    <td className="table-cell text-xs">{row.punctualityScore}%</td>
                  </>
                ) : (
                  <>
                    <td className="table-cell text-white text-xs break-anywhere">{row.internName}</td>
                    <td className="table-cell text-xs">{row.department}</td>
                    <td className="table-cell text-xs">{row.date}</td>
                    <td className="table-cell"><StatusBadge status={row.status} /></td>
                    <td className="table-cell text-xs">{row.punctualityScore}%</td>
                    <td className="table-cell"><button type="button" className="btn-ghost text-xs" onClick={() => { setCorrectId(row.id); setReason(""); }}>Correct</button></td>
                  </>
                )}
              </tr>
            ))}
          </DataTable>
        ) : null}
      </div>
      <Modal open={Boolean(correctId)} onClose={() => setCorrectId(null)} title="Correct attendance">
        <div className="space-y-3 min-w-0">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5">
            <option value="on_time">On time</option>
            <option value="late">Late</option>
            <option value="excused">Excused</option>
            <option value="absent">Absent</option>
          </select>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Correction reason" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <button type="button" disabled={busy} className="btn-primary w-full" onClick={() => void correct()}>Save correction</button>
        </div>
      </Modal>
    </div>
  );
}
