"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconClipboard } from "@/components/icons";
import { EmptyState, StatCard, StatusBadge, Toast } from "@/components/ui";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

export function ReportsPanel({ mode }: { mode: "lead" | "admin" }) {
  const [summary, setSummary] = useState<{ internCount: number; attendanceCount: number; punctualityRate: number; taskCount: number; overdueTasks: number; approvedTasks: number; onboardingSubmitted: number } | null>(null);
  const [reports, setReports] = useState<{ id: string; department?: string; leadName: string; weekNumber: number; status: string; attendanceSummary: string; tasksCompletedSummary: string; tasksInProgressSummary: string; blockersAndRisks: string; resourceRequests: string; adminFeedback?: string | null }[]>([]);
  const [form, setForm] = useState({ attendanceSummary: "", tasksCompletedSummary: "", tasksInProgressSummary: "", blockersAndRisks: "", resourceRequests: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    try {
      const [summaryResponse, reportResponse] = await Promise.all([
        fetch("/api/reports/summary", { cache: "no-store" }),
        fetch("/api/reports", { cache: "no-store" }),
      ]);
      const summaryData = await summaryResponse.json();
      const reportData = await reportResponse.json();
      if (ticket.stale()) return;
      if (!summaryResponse.ok || !summaryData.success) throw new Error(summaryData.error || "Unable to load reports.");
      if (!reportResponse.ok || !reportData.success) throw new Error(reportData.error || "Unable to load reports.");
      setSummary(summaryData.summary ?? null);
      setReports(asList(reportData.reports));
      const current = asList<{ id: string; attendanceSummary?: string; tasksCompletedSummary?: string; tasksInProgressSummary?: string; blockersAndRisks?: string; resourceRequests?: string }>(reportData.reports)[0];
      if (current) {
        setReportId(current.id);
        setForm({
          attendanceSummary: current.attendanceSummary || "",
          tasksCompletedSummary: current.tasksCompletedSummary || "",
          tasksInProgressSummary: current.tasksInProgressSummary || "",
          blockersAndRisks: current.blockersAndRisks || "",
          resourceRequests: current.resourceRequests || "",
        });
      }
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load reports.");
      setSummary(null);
    } finally {
      if (!ticket.stale()) setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function save(action?: "submit") {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "submit" ? { action: "submit", id: reportId } : form),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setToast({ message: data.error || "Unable to save the report.", type: "error" });
      return;
    }
    if (data.id) setReportId(data.id);
    setToast({ message: action === "submit" ? "Report submitted." : "Draft saved.", type: "success" });
    await load();
  }

  async function review(id: string, decision: "reviewed" | "changes_requested") {
    const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", id, decision, feedback: reviewFeedback }) });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setToast({ message: data.error || "Unable to review the report.", type: "error" });
      return;
    }
    setToast({ message: "Review recorded.", type: "success" });
    await load();
  }

  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <Toast message={toast?.message || ""} type={toast?.type || "success"} visible={!!toast} />
      <h2 className="font-heading text-xl font-bold text-white">{mode === "admin" ? "Programme reports" : "Weekly report"}</h2>
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading reports…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Reports unavailable" description={error} /> : null}
      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Interns" value={summary.internCount} icon={<IconClipboard size={18} />} color="green" />
          <StatCard label="Punctuality" value={`${summary.punctualityRate}%`} icon={<IconClipboard size={18} />} color="purple" />
          <StatCard label="Overdue tasks" value={summary.overdueTasks} icon={<IconClipboard size={18} />} color="amber" />
          <StatCard label="Approved tasks" value={summary.approvedTasks} icon={<IconClipboard size={18} />} color="green" />
          <StatCard label="Attendance records" value={summary.attendanceCount} icon={<IconClipboard size={18} />} color="purple" />
          <StatCard label="Onboarding in review" value={summary.onboardingSubmitted} icon={<IconClipboard size={18} />} color="amber" />
        </div>
      ) : null}
      {mode === "lead" ? (
        <div className="glass-card p-4 space-y-3 min-w-0">
          <textarea value={form.attendanceSummary} onChange={(event) => setForm({ ...form, attendanceSummary: event.target.value })} placeholder="Attendance summary" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <textarea value={form.tasksCompletedSummary} onChange={(event) => setForm({ ...form, tasksCompletedSummary: event.target.value })} placeholder="Completed tasks" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <textarea value={form.tasksInProgressSummary} onChange={(event) => setForm({ ...form, tasksInProgressSummary: event.target.value })} placeholder="In-progress tasks" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <textarea value={form.blockersAndRisks} onChange={(event) => setForm({ ...form, blockersAndRisks: event.target.value })} placeholder="Blockers" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <textarea value={form.resourceRequests} onChange={(event) => setForm({ ...form, resourceRequests: event.target.value })} placeholder="Resource requests" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" className="btn-ghost" onClick={() => void save()}>Save draft</button>
            <button type="button" className="btn-primary" onClick={() => void save("submit")}>Submit to admin</button>
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        {reports.map((report) => (
          <article key={report.id} className="glass-card p-4 space-y-2 min-w-0">
            <div className="flex justify-between gap-2">
              <h3 className="text-sm text-white break-words">{report.department} · Week {report.weekNumber} · {report.leadName}</h3>
              <StatusBadge status={report.status} />
            </div>
            <p className="text-xs text-enrollaa-muted-light break-words">{report.attendanceSummary}</p>
            {report.adminFeedback ? <p className="text-xs text-enrollaa-muted-light break-words">Feedback: {report.adminFeedback}</p> : null}
            {mode === "admin" && report.status === "submitted" ? (
              <div className="space-y-2">
                <textarea value={reviewFeedback} onChange={(event) => setReviewFeedback(event.target.value)} placeholder="Review feedback (optional)" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" className="btn-primary text-xs" onClick={() => void review(report.id, "reviewed")}>Mark reviewed</button>
                  <button type="button" className="btn-ghost text-xs" onClick={() => void review(report.id, "changes_requested")}>Request changes</button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
        {!loading && !error && reports.length === 0 ? <EmptyState icon={<IconClipboard size={28} />} title="No weekly reports" description="Submitted department reports will appear here." /> : null}
      </div>
    </div>
  );
}
