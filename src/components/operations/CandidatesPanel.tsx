"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconUsers } from "@/components/icons";
import { EmptyState, StatusBadge } from "@/components/ui";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

export function CandidatesPanel() {
  const [rows, setRows] = useState<{ id: string; firstName: string; surname: string; email: string; department: string; status: string; roleTitle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const nextTicket = useLoadTicket();
  useEffect(() => {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    fetch("/api/invitations", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Unable to load candidates.");
        if (ticket.stale()) return;
        setRows(
          asList<{ id: string; firstName: string; surname: string; email: string; department: string; status: string; roleTitle: string }>(data.invitations).map((row) => ({
            id: row.id,
            firstName: row.firstName,
            surname: row.surname,
            email: row.email,
            department: row.department,
            status: row.status,
            roleTitle: row.roleTitle,
          })),
        );
      })
      .catch((loadError) => {
        if (ticket.stale()) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load candidates.");
        setRows([]);
      })
      .finally(() => {
        if (!ticket.stale()) setLoading(false);
      });
  }, [nextTicket]);
  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <div>
        <h2 className="font-heading text-xl font-bold text-white">Candidates</h2>
        <p className="mt-1 text-sm text-enrollaa-muted-light">Candidate records are the programme invitations. Create and resend them from Invitations. Open registration cannot create accounts.</p>
      </div>
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading candidates…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Candidates unavailable" description={error} /> : null}
      {!loading && !error && rows.length === 0 ? <EmptyState icon={<IconUsers size={28} />} title="No invitations yet" description="Use Invitations to add people to the programme." /> : null}
      {rows.map((row) => (
        <article key={row.id} className="glass-card p-3 space-y-1 min-w-0">
          <div className="flex justify-between gap-2">
            <span className="text-sm text-white break-words">{row.firstName} {row.surname}</span>
            <StatusBadge status={row.status} />
          </div>
          <p className="text-xs text-enrollaa-muted-light break-all">{row.email}</p>
          <p className="text-xs text-enrollaa-muted-light break-words">{row.roleTitle} · {row.department}</p>
        </article>
      ))}
    </div>
  );
}
