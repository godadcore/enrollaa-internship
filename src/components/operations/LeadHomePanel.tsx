"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconClipboard, IconClock, IconTasks, IconUsers } from "@/components/icons";
import { EmptyState, StatCard } from "@/components/ui";
import { useLoadTicket } from "@/lib/use-load-ticket";

export function LeadHomePanel({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [summary, setSummary] = useState<{ internCount: number; punctualityRate: number; overdueTasks: number; submittedTasks: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const nextTicket = useLoadTicket();
  useEffect(() => {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    fetch("/api/reports/summary", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Unable to load overview.");
        if (!data.summary) throw new Error("Unable to load overview.");
        if (ticket.stale()) return;
        setSummary(data.summary);
      })
      .catch((loadError) => {
        if (ticket.stale()) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load overview.");
        setSummary(null);
      })
      .finally(() => {
        if (!ticket.stale()) setLoading(false);
      });
  }, [nextTicket]);
  if (error) return <EmptyState icon={<IconAlertCircle size={28} />} title="Overview unavailable" description={error} />;
  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <h2 className="font-heading text-xl font-bold text-white">Department overview</h2>
      {summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Interns" value={summary.internCount} icon={<IconUsers size={18} />} color="green" onClick={() => onNavigate("team")} />
          <StatCard label="Punctuality" value={`${summary.punctualityRate}%`} icon={<IconClock size={18} />} color="purple" onClick={() => onNavigate("attendance")} />
          <StatCard label="Submitted tasks" value={summary.submittedTasks} icon={<IconTasks size={18} />} color="amber" onClick={() => onNavigate("tasks")} />
          <StatCard label="Overdue" value={summary.overdueTasks} icon={<IconClipboard size={18} />} color="amber" onClick={() => onNavigate("tasks")} />
        </div>
      ) : loading ? (
        <p className="text-sm text-enrollaa-muted-light">Loading overview…</p>
      ) : (
        <EmptyState icon={<IconAlertCircle size={28} />} title="Overview unavailable" description="No overview data was returned." />
      )}
    </div>
  );
}
