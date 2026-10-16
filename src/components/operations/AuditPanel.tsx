"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconShield } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { formatInWAT } from "@/lib/date-utils";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

export function AuditPanel() {
  const [logs, setLogs] = useState<{ id: string; action: string; targetType: string; createdAt: string; actorName: string; actorRole: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const nextTicket = useLoadTicket();
  useEffect(() => {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    fetch("/api/audit", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Unable to load audit records.");
        if (ticket.stale()) return;
        setLogs(asList(data.logs));
      })
      .catch((loadError) => {
        if (ticket.stale()) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load audit records.");
        setLogs([]);
      })
      .finally(() => {
        if (!ticket.stale()) setLoading(false);
      });
  }, [nextTicket]);
  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <h2 className="font-heading text-xl font-bold text-white">Audit log</h2>
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading audit records…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Audit log unavailable" description={error} /> : null}
      {!loading && !error && logs.length === 0 ? <EmptyState icon={<IconShield size={28} />} title="No audit records" description="Sensitive actions will appear here." /> : null}
      {logs.map((log) => (
        <article key={log.id} className="glass-card p-3 min-w-0">
          <p className="text-sm text-white break-words">{log.action}</p>
          <p className="text-xs text-enrollaa-muted-light break-words">{log.actorName} · {log.actorRole} · {log.targetType} · {formatInWAT(log.createdAt)}</p>
        </article>
      ))}
    </div>
  );
}
