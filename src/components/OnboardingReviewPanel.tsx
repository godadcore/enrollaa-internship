"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconCheckCircle } from "@/components/icons";
import { DataTable, EmptyState, Modal, StatusBadge, TabBar, Toast } from "@/components/ui";
import { formatInWAT } from "@/lib/date-utils";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

type ReviewRow = {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  department: string;
  roleTitle: string;
  status: string;
  submittedAt: string;
  reviewNote?: string | null;
  agreementStatus?: "completed" | "pending" | "unavailable";
};

type ReviewDetail = ReviewRow & {
  accountLast4?: string | null;
  documents?: { id: string; kind: string; filename: string }[];
  agreementStatus?: "completed" | "pending" | "unavailable";
};

export function OnboardingReviewPanel() {
  const [submissions, setSubmissions] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [detailError, setDetailError] = useState("");
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding/review", { cache: "no-store" });
      const data = await response.json();
      if (ticket.stale()) return;
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load onboarding submissions.");
      setSubmissions(asList<ReviewRow>(data.submissions));
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load onboarding submissions.");
      setSubmissions([]);
    } finally {
      if (!ticket.stale()) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setNote("");
    try {
      const response = await fetch(`/api/onboarding/review?id=${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load this submission.");
      setDetail(data.submission);
    } catch (detailLoadError) {
      const message = detailLoadError instanceof Error ? detailLoadError.message : "Unable to load this submission.";
      setDetailError(message);
      setToast({ message, type: "error" });
    }
  }

  async function decide(decision: "approved" | "rejected") {
    if (!selectedId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/onboarding/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: selectedId, decision, note }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to record the review.");
      setToast({ message: decision === "approved" ? "Onboarding approved." : "Corrections requested.", type: "success" });
      setSelectedId(null);
      await load();
    } catch (reviewError) {
      setToast({ message: reviewError instanceof Error ? reviewError.message : "Unable to record the review.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  const filtered = filter === "all" ? submissions : submissions.filter((submission) => submission.status === filter);

  return (
    <div className="space-y-4 animate-fade-in-up min-w-0">
      <Toast message={toast?.message || ""} type={toast?.type || "success"} visible={!!toast} />
      <div>
        <h2 className="font-heading text-xl font-bold text-white">Onboarding</h2>
        <p className="mt-1 text-sm text-enrollaa-muted-light">
          Review submitted records. Invitation acceptance, account activation, submission, corrections, and approval are separate states.
        </p>
      </div>
      <TabBar
        tabs={[
          { id: "all", label: "All", count: submissions.length },
          { id: "submitted", label: "Awaiting review", count: submissions.filter((submission) => submission.status === "submitted").length },
          { id: "approved", label: "Approved", count: submissions.filter((submission) => submission.status === "approved").length },
          { id: "rejected", label: "Corrections", count: submissions.filter((submission) => submission.status === "rejected").length },
        ]}
        activeTab={filter}
        onChange={setFilter}
      />
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading submissions…</p> : null}
      {error ? <EmptyState icon={<IconAlertCircle size={28} />} title="Onboarding unavailable" description={error} /> : null}
      {!loading && !error && filtered.length === 0 ? (
        <EmptyState icon={<IconCheckCircle size={28} />} title="No onboarding submissions" description="Submitted onboarding forms will appear here." />
      ) : null}
      <div className="space-y-3 md:hidden">
        {filtered.map((submission) => (
          <button key={submission.id} type="button" onClick={() => void openDetail(submission.id)} className="w-full glass-card p-3 text-left space-y-1 min-w-0">
            <div className="flex justify-between gap-2">
              <span className="text-white text-sm font-medium break-words">{submission.firstName} {submission.surname}</span>
              <StatusBadge status={submission.status} />
            </div>
            <p className="text-xs text-enrollaa-muted-light break-all">{submission.email}</p>
            <p className="text-xs text-enrollaa-muted-light break-words">{submission.department}</p>
          </button>
        ))}
      </div>
      {!loading && !error && filtered.length > 0 ? (
        <div className="hidden md:block">
          <DataTable headers={["Person", "Email", "Department", "Role", "Submitted", "Status"]}>
            {filtered.map((submission) => (
              <tr key={submission.id} className="cursor-pointer" onClick={() => void openDetail(submission.id)}>
                <td className="table-cell break-anywhere font-medium text-white">{submission.firstName} {submission.surname}</td>
                <td className="table-cell break-anywhere text-xs">{submission.email}</td>
                <td className="table-cell"><span className="badge-muted">{submission.department}</span></td>
                <td className="table-cell text-xs">{submission.roleTitle}</td>
                <td className="table-cell text-xs">{formatInWAT(submission.submittedAt, { dateStyle: "medium" })}</td>
                <td className="table-cell"><StatusBadge status={submission.status} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      ) : null}
      <Modal open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title="Onboarding review" size="lg">
        {detail ? (
          <div className="space-y-3 text-sm min-w-0">
            <p className="text-white break-words">{detail.firstName} {detail.surname}</p>
            <p className="text-xs text-enrollaa-muted-light break-all">{detail.email}</p>
            <p className="text-xs text-enrollaa-muted-light break-words">{detail.department} · {detail.roleTitle}</p>
            <p className="text-xs text-enrollaa-muted-light">Status: {detail.status}. Account last4 {detail.accountLast4 || "not stored"}.</p>
            <p className="text-xs text-enrollaa-muted-light">Agreement: {detail.agreementStatus === "completed" ? "Completed with persisted acceptance evidence" : detail.agreementStatus === "pending" ? "Pending acceptance evidence" : "Unavailable"}.</p>
            {detail.reviewNote ? <p className="text-xs text-enrollaa-amber break-words">Note: {detail.reviewNote}</p> : null}
            <div className="flex flex-col gap-2">
              {(detail.documents ?? []).map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className="btn-ghost text-xs text-left break-words"
                  onClick={async () => {
                    const response = await fetch(`/api/onboarding/review/document?documentId=${doc.id}`);
                    const payload = await response.json();
                    if (payload.url) window.open(payload.url, "_blank", "noopener,noreferrer");
                    else setToast({ message: payload.error || "The document is unavailable.", type: "error" });
                  }}
                >
                  Open {doc.kind}: {doc.filename}
                </button>
              ))}
            </div>
            {detail.status === "submitted" ? (
              <>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Review note" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" disabled={busy} className="btn-primary" onClick={() => void decide("approved")}>Approve</button>
                  <button type="button" disabled={busy} className="btn-ghost" onClick={() => void decide("rejected")}>Request corrections</button>
                </div>
              </>
            ) : (
              <p className="text-xs text-enrollaa-muted-light">This record is {detail.status} and cannot be reviewed again.</p>
            )}
          </div>
        ) : detailError ? (
          <p className="text-sm text-enrollaa-red break-words">{detailError}</p>
        ) : (
          <p className="text-sm text-enrollaa-muted-light">Loading…</p>
        )}
      </Modal>
    </div>
  );
}
