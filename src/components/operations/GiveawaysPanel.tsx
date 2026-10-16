"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconPlus, IconTrophy } from "@/components/icons";
import { EmptyState, Modal, StatusBadge, Toast } from "@/components/ui";
import { formatInWAT } from "@/lib/date-utils";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

type Giveaway = { id: string; title: string; description: string; scheduledAt: string; prize1st: number; prize2nd: number; totalBudget: number; punctualityWeight: number; taskWeight: number; status: string };
type Winner = { id: string; giveawayId: string; internName: string; department: string; rank: number; prizeAmount: number; paymentStatus?: string };

export function GiveawaysPanel({ mode }: { mode: "intern" | "staff" }) {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [standing, setStanding] = useState<{ attendanceScore: number; taskScore: number; composite: number; eligible: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", scheduledAt: "", scoringPeriodStart: "", scoringPeriodEnd: "", prize1st: "3000", prize2nd: "2000" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/giveaways", { cache: "no-store" });
      const data = await response.json();
      if (ticket.stale()) return;
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load giveaways.");
      setGiveaways(asList<Giveaway>(data.giveaways));
      setWinners(asList<Winner>(data.winners));
      setStanding(data.standing ?? null);
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load giveaways.");
      setGiveaways([]);
    } finally {
      if (!ticket.stale()) setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/giveaways", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setToast({ message: data.error || "Unable to update giveaway.", type: "error" });
      return;
    }
    setOpen(false);
    setToast({ message: "Giveaway updated.", type: "success" });
    await load();
  }

  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <Toast message={toast?.message || ""} type={toast?.type || "success"} visible={!!toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-bold text-white">Giveaways</h2>
        {mode === "staff" ? <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setOpen(true)}><IconPlus size={14} /> Schedule</button> : null}
      </div>
      {standing ? (
        <div className="glass-card p-4 space-y-2">
          <p className={`text-xs font-heading font-bold ${standing.eligible ? "text-enrollaa-green" : "text-enrollaa-red"}`}>{standing.eligible ? "Eligible (80%+ composite)" : "Below 80% eligibility"}</p>
          <p className="text-xs text-enrollaa-muted-light">Attendance {standing.attendanceScore}% · Tasks {standing.taskScore}% · Composite {standing.composite}%</p>
        </div>
      ) : null}
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading giveaways…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Giveaways unavailable" description={error} /> : null}
      {!loading && !error && giveaways.length === 0 ? <EmptyState icon={<IconTrophy size={28} />} title="No giveaways" description="Scheduled events will appear here." /> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {giveaways.map((event) => (
          <article key={event.id} className="glass-card p-4 space-y-2 min-w-0">
            <div className="flex justify-between gap-2">
              <h3 className="font-heading text-sm font-bold text-white break-words">{event.title}</h3>
              <StatusBadge status={event.status} />
            </div>
            <p className="text-xs text-enrollaa-muted-light break-words">{event.description}</p>
            <p className="text-xs text-enrollaa-muted-light">{formatInWAT(event.scheduledAt)} · ₦{event.totalBudget.toLocaleString()}</p>
            {mode === "staff" && event.status === "scheduled" ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" className="btn-primary text-xs" onClick={() => void post({ action: "execute", id: event.id })}>Complete from scores</button>
                <button type="button" className="btn-ghost text-xs" onClick={() => void post({ action: "cancel", id: event.id })}>Cancel</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <div className="glass-card p-4 space-y-2">
        <h3 className="section-title">Winners</h3>
        {winners.length === 0 ? <p className="text-xs text-enrollaa-muted-light">No winners recorded yet.</p> : null}
        {winners.map((winner) => (
          <div key={winner.id} className="flex flex-wrap justify-between gap-2 text-xs">
            <span className="text-white break-words">#{winner.rank} {winner.internName} · {winner.department}</span>
            <span className="text-enrollaa-green">₦{winner.prizeAmount.toLocaleString()}</span>
            {mode === "staff" && winner.paymentStatus ? (
              <button type="button" className="btn-ghost text-xs" onClick={() => void post({ action: "payment", id: winner.id, paymentStatus: winner.paymentStatus === "paid" ? "pending" : "paid" })}>
                {winner.paymentStatus}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Schedule giveaway">
        <div className="space-y-3 min-w-0">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          <label className="text-xs text-enrollaa-muted-light">Scheduled
            <input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} className="mt-1 w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          </label>
          <label className="text-xs text-enrollaa-muted-light">Scoring start
            <input type="datetime-local" value={form.scoringPeriodStart} onChange={(event) => setForm({ ...form, scoringPeriodStart: event.target.value })} className="mt-1 w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          </label>
          <label className="text-xs text-enrollaa-muted-light">Scoring end
            <input type="datetime-local" value={form.scoringPeriodEnd} onChange={(event) => setForm({ ...form, scoringPeriodEnd: event.target.value })} className="mt-1 w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
          </label>
          <button type="button" className="btn-primary w-full" onClick={() => void post({ ...form, prize1st: Number(form.prize1st), prize2nd: Number(form.prize2nd), scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : "", scoringPeriodStart: form.scoringPeriodStart ? new Date(form.scoringPeriodStart).toISOString() : form.scheduledAt ? new Date(form.scheduledAt).toISOString() : "", scoringPeriodEnd: form.scoringPeriodEnd ? new Date(form.scoringPeriodEnd).toISOString() : form.scheduledAt ? new Date(form.scheduledAt).toISOString() : "" })}>Save</button>
        </div>
      </Modal>
    </div>
  );
}
