"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconCheckCircle, IconClipboard, IconClock, IconTasks } from "@/components/icons";
import { EmptyState, StatCard, Toast } from "@/components/ui";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

export function InternHomePanel({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [summary, setSummary] = useState<{ attendanceCount: number; punctualityRate: number; taskCount: number; overdueTasks: number } | null>(null);
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; content: string }[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setError("");
    try {
      const [summaryResponse, attendanceResponse, announcementResponse] = await Promise.all([
        fetch("/api/reports/summary", { cache: "no-store" }),
        fetch("/api/attendance", { cache: "no-store" }),
        fetch("/api/announcements", { cache: "no-store" }),
      ]);
      const summaryData = await summaryResponse.json();
      const attendanceData = await attendanceResponse.json();
      const announcementData = await announcementResponse.json();
      if (ticket.stale()) return;
      if (!summaryResponse.ok || !summaryData.success) throw new Error(summaryData.error || "Unable to load dashboard.");
      if (!attendanceResponse.ok || !attendanceData.success) throw new Error(attendanceData.error || "Unable to load dashboard.");
      if (!announcementResponse.ok || !announcementData.success) throw new Error(announcementData.error || "Unable to load dashboard.");
      setSummary(summaryData.summary ?? null);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
      setCheckedIn(asList<{ date: string; checkInAt: string | null }>(attendanceData.records).some((row) => row.date === today && row.checkInAt));
      setAnnouncements(asList<{ id: string; title: string; content: string }>(announcementData.announcements).slice(0, 3));
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
      setSummary(null);
    }
  }
  useEffect(() => { void load(); }, []);

  async function checkIn() {
    const response = await fetch("/api/attendance", { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setToast({ message: data.error || "Unable to check in.", type: "error" });
      return;
    }
    setToast({ message: data.message || "Checked in.", type: "success" });
    await load();
  }

  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <Toast message={toast?.message || ""} type={toast?.type || "success"} visible={!!toast} />
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Dashboard unavailable" description={error} /> : null}
      <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold text-white">Today</h2>
          <p className="text-xs text-enrollaa-muted-light">Attendance, tasks, and notices from live programme records.</p>
        </div>
        {checkedIn ? (
          <span className="inline-flex items-center gap-2 text-xs text-enrollaa-green font-heading font-bold"><IconCheckCircle size={16} /> Checked in</span>
        ) : (
          <button type="button" className="btn-primary" onClick={() => void checkIn()}>Check in</button>
        )}
      </div>
      {summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Punctuality" value={`${summary.punctualityRate}%`} icon={<IconClock size={18} />} color="green" onClick={() => onNavigate("attendance")} />
          <StatCard label="My task records" value={summary.taskCount} icon={<IconTasks size={18} />} color="purple" onClick={() => onNavigate("tasks")} />
          <StatCard label="Overdue" value={summary.overdueTasks} icon={<IconClipboard size={18} />} color="amber" onClick={() => onNavigate("tasks")} />
        </div>
      ) : null}
      <div className="space-y-2">
        <h3 className="section-title">Announcements</h3>
        {announcements.length === 0 ? <p className="text-xs text-enrollaa-muted-light">No published announcements.</p> : null}
        {announcements.map((item) => (
          <article key={item.id} className="glass-card p-3 min-w-0">
            <p className="text-sm text-white break-words">{item.title}</p>
            <p className="text-xs text-enrollaa-muted-light break-words">{item.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
