"use client";

import React, { useEffect, useState } from "react";
import { Modal, StatusBadge } from "@/components/ui";

export type OperationalTask = {
  id: string;
  title: string;
  description: string;
  instructions?: string | null;
  acceptanceCriteria?: string | null;
  assignedToName: string;
  assignedToProfileId: string | null;
  priority: string;
  status: string;
  dueAt: string;
  submissions: { id: string; internProfileId: string; internName: string; deliverableUrl: string; notes: string | null; reviewStatus: string; reviewFeedback: string | null }[];
  comments: { id: string; parentCommentId?: string | null; authorName: string; message: string; createdAt: string }[];
};

export function OperationalTaskModal({
  task,
  onClose,
  onUpdated,
  mode,
}: {
  task: OperationalTask | null;
  onClose: () => void;
  onUpdated: () => void;
  mode: "intern" | "staff";
}) {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [comments, setComments] = useState(task?.comments ?? []);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setComments(task?.comments ?? []);
  }, [task]);
  if (!task) return null;
  const submission = task.submissions[0];

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save.");
      if (path === "/api/tasks/comments" && data.comment) {
        setComments((current) => [...current, data.comment]);
        setComment("");
        setReplyTo(null);
      }
      if (path === "/api/tasks/review") setSuccess(body.decision === "approved" ? "Project approved successfully." : "Revision request saved.");
      onUpdated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={Boolean(task)} onClose={onClose} title={task.title} size="lg">
      <div className="space-y-3 text-sm min-w-0">
        <StatusBadge status={task.status} />
        <p className="text-enrollaa-muted-light break-words">{task.description}</p>
        {task.instructions ? <p className="text-xs text-enrollaa-muted-light break-words">{task.instructions}</p> : null}
        {task.acceptanceCriteria ? <p className="text-xs text-enrollaa-green break-words">{task.acceptanceCriteria}</p> : null}
        {submission ? (
          <p className="text-xs break-all">Deliverable: {submission.deliverableUrl}</p>
        ) : null}
        {mode === "intern" && task.status !== "approved" ? (
          <>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://deliverable.example" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
            <button type="button" disabled={busy} className="btn-primary" onClick={() => void post("/api/tasks/submissions", { taskId: task.id, deliverableUrl: url, notes })}>Submit work</button>
          </>
        ) : null}
        {mode === "staff" && submission ? (
          <>
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Review feedback" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" disabled={busy} className="btn-primary" onClick={() => void post("/api/tasks/review", { taskId: task.id, internProfileId: submission.internProfileId, decision: "approved", feedback })}>Approve</button>
              <button type="button" disabled={busy} className="btn-ghost" onClick={() => void post("/api/tasks/review", { taskId: task.id, internProfileId: submission.internProfileId, decision: "revision_requested", feedback })}>Request revision</button>
            </div>
          </>
        ) : null}
        <div className="space-y-2">
          {comments.map((item) => (
            <div key={item.id} className={`text-xs text-enrollaa-muted-light break-words ${item.parentCommentId ? "ml-4 border-l border-white/10 pl-2" : ""}`}>
              <p><span className="text-white">{item.authorName}:</span> {item.message}</p>
              <button type="button" className="text-enrollaa-green text-[11px]" onClick={() => setReplyTo(item.id)}>Reply</button>
            </div>
          ))}
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder={replyTo ? "Write a reply" : "Write a comment"} className="flex-1 min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
            <button type="button" disabled={busy} className="btn-ghost" onClick={() => void post("/api/tasks/comments", { taskId: task.id, message: comment, parentCommentId: replyTo })}>{replyTo ? "Reply" : "Comment"}</button>
          </div>
        </div>
        {success ? <p className="text-xs text-enrollaa-green break-words">{success}</p> : null}
        {error ? <p className="text-xs text-enrollaa-red break-words">{error}</p> : null}
      </div>
    </Modal>
  );
}
