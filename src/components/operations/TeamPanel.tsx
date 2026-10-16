"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconUsers } from "@/components/icons";
import { EmptyState, StatusBadge } from "@/components/ui";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

export function TeamPanel() {
  const [staff, setStaff] = useState<{ id: string; firstName: string; surname: string; email: string; role: string; isActive: boolean; roleTitle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const nextTicket = useLoadTicket();
  useEffect(() => {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    fetch("/api/staff", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Unable to load team.");
        if (ticket.stale()) return;
        setStaff(asList<typeof staff[number]>(data.staff).filter((row) => row.role === "intern"));
      })
      .catch((loadError) => {
        if (ticket.stale()) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load team.");
        setStaff([]);
      })
      .finally(() => {
        if (!ticket.stale()) setLoading(false);
      });
  }, [nextTicket]);
  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <h2 className="font-heading text-xl font-bold text-white">My team</h2>
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading team…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Team unavailable" description={error} /> : null}
      {!loading && !error && staff.length === 0 ? <EmptyState icon={<IconUsers size={28} />} title="No interns" description="Interns in your department will appear here." /> : null}
      {staff.map((row) => (
        <article key={row.id} className="glass-card p-3 min-w-0">
          <div className="flex justify-between gap-2">
            <span className="text-sm text-white break-words">{row.firstName} {row.surname}</span>
            <StatusBadge status={row.isActive ? "active" : "inactive"} />
          </div>
          <p className="text-xs text-enrollaa-muted-light break-all">{row.email}</p>
          <p className="text-xs text-enrollaa-muted-light">{row.roleTitle}</p>
        </article>
      ))}
    </div>
  );
}
