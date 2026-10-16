"use client";

import React, { useEffect, useState } from "react";
import {
  IconUsers,
  IconClock,
  IconCheckCircle,
  IconClipboard,
  IconAlertCircle,
  IconSend,
  IconSearch,
  IconXCircle,
} from "@/components/icons";
import { useApp } from "@/lib/state";
import {
  DashboardShell,
  StatCard,
  Modal,
  StatusBadge,
  EmptyState,
  DataTable,
  TabBar,
  Toast,
  CustomSelect,
  CustomDatePicker,
} from "@/components/ui";
import { ProfileSettings } from "@/components/ProfileSettings";
import { formatInWAT } from "@/lib/date-utils";
import { canResendInvitation, canRevokeInvitation, invitationStatusView } from "@/lib/invitation-status";
import { OnboardingReviewPanel } from "@/components/OnboardingReviewPanel";
import { DepartmentsManagementPanel } from "@/components/DepartmentsManagementPanel";
import { StaffManagementPanel } from "@/components/StaffManagementPanel";
import { AttendancePanel } from "@/components/operations/AttendancePanel";
import { TasksPanel } from "@/components/operations/TasksPanel";
import { ReportsPanel } from "@/components/operations/ReportsPanel";
import { GiveawaysPanel } from "@/components/operations/GiveawaysPanel";
import { AnnouncementsPanel } from "@/components/operations/AnnouncementsPanel";
import { AuditPanel } from "@/components/operations/AuditPanel";
import { CandidatesPanel } from "@/components/operations/CandidatesPanel";
import { internshipRoleSelectOptions, OFFICIAL_INTERNSHIP_ROLE_NAMES } from "@/lib/internship-roles";
import { asList, useLoadTicket } from "@/lib/use-load-ticket";

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <DashboardShell activeSection={activeSection} onSectionChange={setActiveSection}>
      {activeSection === "overview" && <AdminOverview onOpenSection={setActiveSection} />}
      {activeSection === "candidates" && <CandidatesPanel />}
      {activeSection === "invitations" && <InvitationsSection />}
      {activeSection === "onboarding" && <OnboardingReviewPanel />}
      {activeSection === "departments" && <DepartmentsManagementPanel />}
      {activeSection === "staff" && <StaffManagementPanel />}
      {activeSection === "attendance" && <AttendancePanel mode="staff" />}
      {activeSection === "tasks" && <TasksPanel mode="staff" />}
      {activeSection === "reports" && <ReportsPanel mode="admin" />}
      {activeSection === "giveaways" && <GiveawaysPanel mode="staff" />}
      {activeSection === "announcements" && <AnnouncementsPanel canPublish />}
      {activeSection === "audit-log" && <AuditPanel />}
      {activeSection === "profile" && <ProfileSettings />}
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Admin Overview                                                     */
/* ------------------------------------------------------------------ */
type ProgrammeSummary = {
  totalInvitations: number;
  awaitingResponse: number;
  notYetDelivered: number;
  onboardingInProgress: number;
  submissionsAwaitingReview: number;
  activeInterns: number;
  revokedOrExpired: number;
  departments: { id: string; name: string; slug: string; internCount: number; leads: string[] }[];
  submissions: { id: string; firstName: string; surname: string; email: string; department: string; roleTitle: string; status: string; submittedAt: string }[];
};

function AdminOverview({ onOpenSection }: { onOpenSection: (id: string) => void }) {
  const { currentUser } = useApp();
  const [summary, setSummary] = useState<ProgrammeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    let active = true;
    fetch("/api/programme-summary", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Unable to load the programme summary.");
        if (active) setSummary(data.summary);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load the programme summary.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading text-xl md:text-2xl font-bold text-white">{greeting}, {currentUser.first_name || "there"}.</h2>
        <p className="mt-1 text-xs md:text-sm text-enrollaa-muted-light">Invitation, onboarding, and active intern counts from the programme records.</p>
      </div>
      {loading ? <p className="text-sm text-enrollaa-muted-light">Loading programme summary…</p> : null}
      {error ? (
        <EmptyState icon={<IconAlertCircle size={28} />} title="Summary unavailable" description={error} />
      ) : null}
      {summary ? (
        <>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-3">
            <StatCard label="Total invitations" value={summary.totalInvitations} icon={<IconSend size={20} />} color="purple" onClick={() => onOpenSection("invitations")} />
            <StatCard label="Awaiting response" value={summary.awaitingResponse} icon={<IconClock size={20} />} color="amber" trend={summary.notYetDelivered > 0 ? `${summary.notYetDelivered} not delivered yet` : "Sent or waiting to be sent"} onClick={() => onOpenSection("invitations")} />
            <StatCard label="Onboarding in progress" value={summary.onboardingInProgress} icon={<IconClipboard size={20} />} color="purple" onClick={() => onOpenSection("onboarding")} />
            <StatCard label="Submissions awaiting review" value={summary.submissionsAwaitingReview} icon={<IconCheckCircle size={20} />} color="amber" onClick={() => onOpenSection("onboarding")} />
            <StatCard label="Active interns" value={summary.activeInterns} icon={<IconUsers size={20} />} color="green" />
            <StatCard label="Revoked or expired" value={summary.revokedOrExpired} icon={<IconXCircle size={20} />} color="red" onClick={() => onOpenSection("invitations")} />
          </div>
          <div className="glass-card p-4 md:p-5">
            <h3 className="section-title mb-3">Departments</h3>
            {summary.departments.length === 0 ? (
              <p className="text-sm text-enrollaa-muted-light">No active departments are recorded.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {summary.departments.map((department) => (
                  <div key={department.id} className="flex items-center justify-between gap-3 rounded-sm bg-white/[0.03] px-3 py-2">
                    <span className="min-w-0 text-sm text-white break-anywhere">{department.name}</span>
                    <span className="badge-muted shrink-0">{department.internCount} active</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Invitations Section (Bulk + Single invite management)             */
/* ------------------------------------------------------------------ */
function InvitationsSection() {
  type InvitationRecord = {
    id: string;
    firstName: string;
    surname: string;
    email: string;
    department: string;
    roleTitle: string;
    status: string;
    invitationSentAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  };
  type InvitationDraft = { firstName: string; surname: string; email: string; phone?: string };
  type DepartmentOption = { id: string; name: string; slug: string };
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [composerMode, setComposerMode] = useState("single");
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [departmentSlug, setDepartmentSlug] = useState("");
  const [role, setRole] = useState<string>(OFFICIAL_INTERNSHIP_ROLE_NAMES[0]);
  const [assignedRole, setAssignedRole] = useState("intern");
  const [intendedStartDate, setIntendedStartDate] = useState("2026-10-19");
  const [preview, setPreview] = useState<{
    valid: InvitationDraft[];
    invalid: string[];
    validEmails: string[];
    invalidEmails: string[];
    internalDuplicates: string[];
    existingCandidates: string[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeModalId, setRevokeModalId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const nextTicket = useLoadTicket();

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const parseRows = (value: string) => {
    const valid: InvitationDraft[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();
    const internalDuplicates: string[] = [];
    value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
      const [rowFirstName = "", rowSurname = "", rowEmail = "", rowPhone = ""] = line.split(",").map((part) => part.trim());
      if (rowFirstName && rowSurname && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rowEmail)) {
        const normalized = rowEmail.toLowerCase();
        if (seen.has(normalized)) {
          internalDuplicates.push(normalized);
          return;
        }
        seen.add(normalized);
        valid.push({ firstName: rowFirstName, surname: rowSurname, email: normalized, phone: rowPhone || undefined });
      } else invalid.push(line);
    });
    const existingCandidates = valid
      .map((entry) => entry.email)
      .filter((entryEmail) =>
        invitations.some((invitation) =>
          invitation.email.toLowerCase() === entryEmail &&
          !["revoked", "expired"].includes(invitation.status)
        )
      );
    return { valid, invalid, validEmails: valid.map((entry) => entry.email), invalidEmails: invalid, internalDuplicates, existingCandidates };
  };

  const loadInvitations = async () => {
    const ticket = nextTicket();
    setLoadingInvitations(true);
    try {
      const [invitationResponse, summaryResponse] = await Promise.all([
        fetch("/api/invitations", { cache: "no-store" }),
        fetch("/api/programme-summary", { cache: "no-store" }),
      ]);
      const data = await invitationResponse.json();
      if (ticket.stale()) return;
      if (!invitationResponse.ok || !data.success) throw new Error(data.error || "Unable to load invitations.");
      setInvitations(asList<InvitationRecord>(data.invitations));
      const summaryData = await summaryResponse.json();
      if (summaryResponse.ok && summaryData.success) {
        const nextDepartments = asList<DepartmentOption>(summaryData.summary?.departments);
        setDepartments(nextDepartments);
        setDepartmentSlug((current) => current || nextDepartments[0]?.slug || "");
      }
    } catch (error) {
      if (ticket.stale()) return;
      showToast(error instanceof Error ? error.message : "Unable to load invitations.", "error");
    } finally {
      if (!ticket.stale()) setLoadingInvitations(false);
    }
  };
  useEffect(() => { void loadInvitations(); }, []);

  const currentDraft = () => composerMode === "single"
    ? parseRows([firstName, surname, email, phone].map((value) => value.trim()).join(","))
    : parseRows(bulkInput);

  const handlePreview = async () => {
    const source = composerMode === "single" ? `${firstName},${surname},${email}` : bulkInput;
    if (!source.trim()) return;
    setPreviewLoading(true);
    setPreview(currentDraft());
    setPreviewLoading(false);
  };

  const handleSendBulk = async () => {
    if (sendLoading) return;
    setSendLoading(true);
    try {
      const parsed = preview ?? currentDraft();
      const entries = parsed.valid.filter((entry) => !parsed.existingCandidates.includes(entry.email));
      if (!departmentSlug) {
        showToast("Choose a department before sending invitations.", "error");
        return;
      }
      if (!parsed.valid.length) {
        showToast("Enter a first name, surname, and valid email address.", "error");
        return;
      }
      if (parsed.invalid.length) {
        showToast("Fix the highlighted rows before sending.", "error");
        return;
      }
      if (!entries.length) {
        showToast("Those email addresses already have an active invitation. Use Resend instead.", "error");
        return;
      }
      let created = 0;
      let accepted = 0;
      let deliveryFailed = 0;
      let rejected = 0;
      for (const entry of entries) {
        const response = await fetch("/api/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...entry, departmentSlug, assignedRole, roleTitle: role.trim() || OFFICIAL_INTERNSHIP_ROLE_NAMES[0], intendedStartDate: intendedStartDate || "2026-10-19" }),
        });
        const data = await response.json();
        if (typeof data.invitationId === "string") created += 1;
        if (data.success) accepted += 1;
        else if (typeof data.invitationId === "string") deliveryFailed += 1;
        else rejected += 1;
      }
      await loadInvitations();
      if (created) {
        setBulkInput("");
        setFirstName("");
        setSurname("");
        setEmail("");
        setPhone("");
        setPreview(null);
      }
      if (deliveryFailed || rejected) {
        showToast(`${created} invitation(s) saved. ${accepted} email(s) were accepted. ${deliveryFailed} could not be delivered${rejected ? ` and ${rejected} were rejected` : ""}.`, "error");
      } else {
        showToast(`${created} invitation(s) saved and ${accepted} onboarding email(s) accepted. Accounts are not active until onboarding is finished.`);
      }
    } catch {
      showToast("Network error. Could not reach the server.", "error");
    } finally {
      setSendLoading(false);
    }
  };

  const handleResend = async (invitationId: string) => {
    setResendingId(invitationId);
    try {
      const res = await fetch("/api/invitations/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const data = await res.json();
      if (data.success) showToast("Invitation email was accepted by the provider.");
      else showToast(data.error || "Invitation delivery failed. The invitation was not marked sent.", "error");
    } catch {
      showToast("Network error. Could not resend the invitation.", "error");
    } finally {
      await loadInvitations();
      setResendingId(null);
    }
  };

  const openRevokeModal = (invitationId: string) => {
    setRevokeModalId(invitationId);
    setRevokeReason("");
  };
  const closeRevokeModal = () => { setRevokeModalId(null); setRevokeReason(""); };
  const handleRevoke = async () => {
    if (!revokeModalId || revokingId) return;
    const trimmedReason = revokeReason.trim();
    if (!trimmedReason) { showToast("A revocation reason is required.", "error"); return; }
    const invitationId = revokeModalId;
    setRevokingId(invitationId);
    try {
      const res = await fetch("/api/invitations/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, reason: trimmedReason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Invitation revoked.");
        closeRevokeModal();
        await loadInvitations();
      } else {
        showToast(data.error || "Failed to revoke the invitation.", "error");
      }
    } catch {
      showToast("Network error. The invitation was not revoked.", "error");
    } finally {
      setRevokingId(null);
    }
  };

  const visibleInvitations = invitations.filter((invitation) => {
    const view = invitationStatusView(invitation.status);
    const matchesQuery = `${invitation.firstName} ${invitation.surname} ${invitation.email} ${invitation.department}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "awaiting" && (invitation.status === "selected" || invitation.status === "invitation_sent"))
      || (statusFilter === "onboarding" && view.onboarding === "in_progress")
      || (statusFilter === "submitted" && view.onboarding === "submitted")
      || (statusFilter === "active" && view.account === "active")
      || (statusFilter === "closed" && (invitation.status === "revoked" || invitation.status === "expired"));
    return matchesQuery && matchesStatus;
  });
  const sendableCount = preview ? preview.validEmails.length - preview.existingCandidates.length : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {toast && <Toast visible={true} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div>
        <h2 className="font-heading text-xl font-bold text-white">Invitations</h2>
        <p className="mt-1 text-sm text-enrollaa-muted-light">
          Create a private onboarding link for each person. Sending an invitation does not complete onboarding or activate an account.
        </p>
      </div>

      <div className="glass-card space-y-4 p-4 md:p-5">
        <h3 className="flex items-center gap-2 font-heading text-sm font-bold text-white">
          <IconSend size={14} className="text-enrollaa-green" />
          New invitation
        </h3>
        <TabBar
          tabs={[{ id: "single", label: "One person" }, { id: "batch", label: "Several people" }]}
          activeTab={composerMode}
          onChange={(mode) => { setComposerMode(mode); setPreview(null); }}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label-text" htmlFor="invitation-department">Department</label>
            <CustomSelect
              value={departmentSlug}
              onChange={setDepartmentSlug}
              options={departments.map((department) => ({ value: department.slug, label: department.name }))}
              placeholder={departments.length ? "Select a department" : "No departments available"}
              disabled={!departments.length || sendLoading}
              aria-label="Department"
            />
          </div>
          <div>
            <label className="label-text" htmlFor="invitation-role">Internship role</label>
            {assignedRole === "intern" ? (
              <CustomSelect
                value={role}
                onChange={setRole}
                options={internshipRoleSelectOptions(role)}
                disabled={sendLoading}
                aria-label="Internship role"
              />
            ) : (
              <input id="invitation-role" type="text" value={role} onChange={(event) => setRole(event.target.value)} placeholder="Department Lead" className="input-field" disabled={sendLoading} />
            )}
            <p className="mt-1 text-[11px] text-enrollaa-muted-light break-words">
              {assignedRole === "intern"
                ? "Job category for the intern. This is not an account permission."
                : "Staff job title. Account permissions come from account type."}
            </p>
          </div>
          <div>
            <label className="label-text">Account type</label>
            <CustomSelect
              value={assignedRole}
              onChange={(value) => {
                setAssignedRole(value);
                if (value === "intern") setRole(OFFICIAL_INTERNSHIP_ROLE_NAMES[0]);
                else if (role === OFFICIAL_INTERNSHIP_ROLE_NAMES[0]) setRole("Department Lead");
              }}
              disabled={sendLoading}
              options={[
                { value: "intern", label: "Intern" },
                { value: "lead", label: "Department lead" },
                { value: "manager", label: "Manager" },
                { value: "admin", label: "Admin" },
                { value: "super_admin", label: "Super admin" },
              ]}
              aria-label="Account type"
            />
          </div>
          <div>
            <label className="label-text">Intended start date</label>
            <CustomDatePicker value={intendedStartDate} onChange={setIntendedStartDate} />
          </div>
        </div>

        {composerMode === "single" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-text" htmlFor="invite-first-name">First name</label>
              <input id="invite-first-name" className="input-field" value={firstName} onChange={(event) => { setFirstName(event.target.value); setPreview(null); }} disabled={sendLoading} />
            </div>
            <div>
              <label className="label-text" htmlFor="invite-surname">Surname</label>
              <input id="invite-surname" className="input-field" value={surname} onChange={(event) => { setSurname(event.target.value); setPreview(null); }} disabled={sendLoading} />
            </div>
            <div>
              <label className="label-text" htmlFor="invite-email">Email address</label>
              <input id="invite-email" type="email" className="input-field" value={email} onChange={(event) => { setEmail(event.target.value); setPreview(null); }} placeholder="name@example.com" disabled={sendLoading} />
            </div>
            <div>
              <label className="label-text" htmlFor="invite-phone">Phone <span className="normal-case tracking-normal text-enrollaa-muted-dark">(optional)</span></label>
              <input id="invite-phone" className="input-field" value={phone} onChange={(event) => { setPhone(event.target.value); setPreview(null); }} placeholder="+2348000000000" disabled={sendLoading} />
            </div>
          </div>
        ) : (
          <div>
            <label className="label-text" htmlFor="invite-batch">People</label>
            <p className="mb-2 text-xs text-enrollaa-muted-light">One person per line: first name, surname, email, and an optional phone, separated by commas.</p>
            <textarea
              id="invite-batch"
              value={bulkInput}
              onChange={(event) => { setBulkInput(event.target.value); setPreview(null); }}
              placeholder={"Ada, Okafor, ada@example.com, +2348000000000\nTobi, James, tobi@example.com"}
              rows={4}
              disabled={sendLoading}
              className="input-field resize-y font-mono"
            />
          </div>
        )}

        {preview && (
          <div className="space-y-3 rounded-sm border border-white/10 bg-white/[0.04] p-4">
            <p className="font-heading text-xs font-bold text-white">Check before sending</p>
            <div className="flex flex-wrap gap-2">
              {preview.valid.map((entry) => (
                <span key={entry.email} className={`break-anywhere rounded-sm border px-2.5 py-1 text-[11px] ${preview.existingCandidates.includes(entry.email) ? "border-enrollaa-amber/30 bg-enrollaa-amber/10 text-enrollaa-amber" : "border-enrollaa-green/30 bg-enrollaa-green/10 text-enrollaa-green"}`}>
                  {entry.firstName} {entry.surname} · {entry.email}
                </span>
              ))}
              {preview.invalidEmails.map((row) => (
                <span key={row} className="break-anywhere rounded-sm border border-enrollaa-red/30 bg-enrollaa-red/10 px-2.5 py-1 text-[11px] text-enrollaa-red">{row}</span>
              ))}
            </div>
            {preview.invalidEmails.length > 0 && <p className="text-[11px] text-enrollaa-red">Each row needs a first name, surname, and email such as name@example.com.</p>}
            {preview.internalDuplicates.length > 0 && <p className="text-[11px] text-enrollaa-amber">Duplicate emails in this list were skipped.</p>}
            {preview.existingCandidates.length > 0 && <p className="text-[11px] text-enrollaa-amber">{preview.existingCandidates.length} email(s) already have an active invitation and will be skipped.</p>}
            <p className="text-[11px] text-enrollaa-muted-light">{Math.max(sendableCount, 0)} invitation(s) can be sent.</p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={handlePreview} disabled={previewLoading || sendLoading} className="btn-secondary text-xs">{previewLoading ? "Checking…" : "Check details"}</button>
          <button type="button" onClick={handleSendBulk} disabled={sendLoading || !departmentSlug} className="btn-primary text-xs">
            <IconSend size={13} />
            {sendLoading ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="font-heading text-sm font-bold text-white">Invitation records ({visibleInvitations.length})</h3>
          <div className="grid w-full grid-cols-1 gap-2 sm:max-w-xl sm:grid-cols-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="input-field" aria-label="Search invitations" />
            <CustomSelect
              value={statusFilter}
              onChange={setStatusFilter}
              aria-label="Filter invitations"
              options={[
                { value: "all", label: "All statuses" },
                { value: "awaiting", label: "Awaiting response" },
                { value: "onboarding", label: "Onboarding in progress" },
                { value: "submitted", label: "Onboarding submitted" },
                { value: "active", label: "Active accounts" },
                { value: "closed", label: "Revoked or expired" },
              ]}
            />
          </div>
        </div>
        {loadingInvitations ? (
          <p className="py-6 text-sm text-enrollaa-muted-light">Loading invitations…</p>
        ) : invitations.length === 0 ? (
          <EmptyState icon={<IconSend size={28} />} title="No invitations yet" description="Create an invitation above. The person will receive a private onboarding link." />
        ) : visibleInvitations.length === 0 ? (
          <EmptyState icon={<IconSearch size={28} />} title="No matching invitations" description="Try another name, email, or status." />
        ) : (
          <DataTable headers={["Recipient", "Email", "Department", "Invitation", "Onboarding", "Account", "Dates", "Actions"]}>
            {visibleInvitations.map((invitation) => {
              const view = invitationStatusView(invitation.status);
              const isResending = resendingId === invitation.id;
              const isRevoking = revokingId === invitation.id;
              return (
                <tr key={invitation.id} className="hover:bg-white/[0.02]">
                  <td className="table-cell">
                    <p className="break-anywhere font-heading text-sm font-medium text-white">{invitation.firstName} {invitation.surname}</p>
                    <p className="text-[11px] text-enrollaa-muted-light">{invitation.roleTitle}</p>
                  </td>
                  <td className="table-cell break-anywhere text-xs text-enrollaa-muted-light">{invitation.email}</td>
                  <td className="table-cell"><span className="badge-muted">{invitation.department}</span></td>
                  <td className="table-cell"><StatusBadge status={view.invitation} /></td>
                  <td className="table-cell"><StatusBadge status={view.onboarding} /></td>
                  <td className="table-cell"><StatusBadge status={view.account} /></td>
                  <td className="table-cell text-xs text-enrollaa-muted-light">
                    <p>Sent {invitation.invitationSentAt ? formatInWAT(invitation.invitationSentAt, { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
                    <p>Expires {invitation.expiresAt ? formatInWAT(invitation.expiresAt, { dateStyle: "medium" }) : "—"}</p>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {canResendInvitation(invitation.status) && (
                        <button type="button" onClick={() => handleResend(invitation.id)} disabled={isResending || !!revokingId} className="btn-ghost px-2 text-xs text-enrollaa-green">
                          <IconSend size={11} />
                          {isResending ? "Sending…" : "Resend"}
                        </button>
                      )}
                      {canRevokeInvitation(invitation.status) && (
                        <button type="button" onClick={() => openRevokeModal(invitation.id)} disabled={isRevoking || !!resendingId} className="btn-ghost px-2 text-xs text-enrollaa-red">
                          <IconXCircle size={11} />
                          {isRevoking ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                      {!canResendInvitation(invitation.status) && !canRevokeInvitation(invitation.status) ? <span className="text-xs text-enrollaa-muted-dark">No actions</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>

      <Modal open={!!revokeModalId} onClose={() => { if (!revokingId) closeRevokeModal(); }} title="Revoke invitation" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-enrollaa-muted-light">This stops the current onboarding link. Add the reason that should be kept with the record.</p>
          <div>
            <label htmlFor="invitation-revocation-reason" className="label-text">Revocation reason</label>
            <textarea id="invitation-revocation-reason" value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} disabled={!!revokingId} rows={3} placeholder="Enter a clear reason" className="input-field resize-y disabled:opacity-60" />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeRevokeModal} disabled={!!revokingId} className="btn-secondary text-xs disabled:opacity-60">Cancel</button>
            <button type="button" onClick={handleRevoke} disabled={!revokeReason.trim() || !!revokingId} className="btn-danger text-xs disabled:opacity-60">{revokingId ? "Revoking…" : "Revoke invitation"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

