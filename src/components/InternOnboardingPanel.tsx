"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconCheckCircle, IconUpload } from "@/components/icons";
import { CustomSelect } from "@/components/CustomSelect";
import { NIGERIAN_BANKS, NIGERIAN_STATES, OWNERSHIP_AGREEMENT_TEXT } from "@/lib/constants";
import { useLoadTicket } from "@/lib/use-load-ticket";

type OnboardingPayload = {
  invitation: { firstName: string; surname: string; email: string; roleTitle: string; department: string; invitationStatus: string };
  agreement: { id: string; version: string; title: string; content: string } | null;
  submission: {
    id: string;
    status: string;
    phone: string | null;
    locationState: string | null;
    locationCity: string | null;
    sex: string | null;
    institution: string | null;
    stateOfResidence: string | null;
    educationDetails: { bank_name?: string; account_name?: string } | null;
    reviewNote: string | null;
    accountLast4: string | null;
    documents: { kind: string; original_filename: string }[];
  } | null;
};

export function InternOnboardingPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<OnboardingPayload | null>(null);
  const [phone, setPhone] = useState("");
  const [sex, setSex] = useState("Prefer not to say");
  const [locationState, setLocationState] = useState("Lagos");
  const [locationCity, setLocationCity] = useState("");
  const [institution, setInstitution] = useState("");
  const [bankName, setBankName] = useState("Access Bank");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [signature, setSignature] = useState("");
  const [accepted, setAccepted] = useState(false);
  const nextTicket = useLoadTicket();

  async function load() {
    const ticket = nextTicket();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding/me", { cache: "no-store" });
      const payload = await response.json();
      if (ticket.stale()) return;
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to load onboarding.");
      const onboarding = payload.onboarding as OnboardingPayload;
      setData(onboarding);
      const submission = onboarding.submission;
      if (submission) {
        setPhone(submission.phone || "");
        setSex(submission.sex || "Prefer not to say");
        setLocationState(submission.locationState || "Lagos");
        setLocationCity(submission.locationCity || "");
        setInstitution(submission.institution || "");
        setBankName(submission.educationDetails?.bank_name || "Access Bank");
        setAccountName(submission.educationDetails?.account_name || "");
      }
    } catch (loadError) {
      if (ticket.stale()) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load onboarding.");
    } finally {
      if (!ticket.stale()) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const locked = Boolean(data?.submission && !["draft", "rejected"].includes(data.submission.status));
  const photo = data?.submission?.documents?.find((doc) => doc.kind === "photo");
  const cv = data?.submission?.documents?.find((doc) => doc.kind === "cv");

  async function saveDraft() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/onboarding/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, sex, locationState, locationCity, institution, stateOfResidence: locationState, bankName, accountName }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to save the draft.");
      setSuccess("Draft saved.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the draft.");
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: "photo" | "cv", file: File | undefined) {
    if (!file || locked) return;
    const draftValues = { phone, sex, locationState, locationCity, institution, bankName, accountName, accountNumber, signature, accepted };
    setError("");
    setSuccess("");
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    const response = await fetch("/api/onboarding/documents", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(payload.error || "The document could not be uploaded.");
      return;
    }
    setSuccess(kind === "photo" ? "Photograph uploaded." : "CV uploaded.");
    await load();
    setPhone(draftValues.phone);
    setSex(draftValues.sex);
    setLocationState(draftValues.locationState);
    setLocationCity(draftValues.locationCity);
    setInstitution(draftValues.institution);
    setBankName(draftValues.bankName);
    setAccountName(draftValues.accountName);
    setAccountNumber(draftValues.accountNumber);
    setSignature(draftValues.signature);
    setAccepted(draftValues.accepted);
  }

  async function submit() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (!accepted) throw new Error("Accept the agreement before submitting.");
      const response = await fetch("/api/onboarding/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typedSignature: signature, accountNumber, bankName, accountName }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to submit onboarding.");
      setSuccess("Onboarding submitted for review.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit onboarding.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-enrollaa-muted-light">Loading onboarding…</p>;
  if (!data) return <p className="text-sm text-enrollaa-red">{error || "Onboarding is unavailable."}</p>;

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h2 className="font-heading text-xl font-bold text-white">Onboarding</h2>
        <p className="mt-1 text-sm text-enrollaa-muted-light">
          Account activation is complete. This form is your programme onboarding record.
        </p>
      </div>
      <div className="glass-card p-4 space-y-2 text-xs min-w-0">
        <p className="text-white font-medium break-words">
          {data.invitation.firstName} {data.invitation.surname}
        </p>
        <p className="text-enrollaa-green break-all">{data.invitation.email}</p>
        <p className="text-enrollaa-muted-light break-words">
          {data.invitation.roleTitle} · {data.invitation.department}
        </p>
        <p className="text-enrollaa-muted-light">
          Invitation: {data.invitation.invitationStatus}
          {data.submission ? ` · Onboarding: ${data.submission.status}` : " · Onboarding: not started"}
        </p>
        {data.submission?.reviewNote ? (
          <p className="text-enrollaa-amber break-words">Reviewer note: {data.submission.reviewNote}</p>
        ) : null}
      </div>

      {error ? (
        <div className="text-xs text-enrollaa-red bg-enrollaa-red/10 border border-enrollaa-red/25 rounded-sm p-3 flex gap-2">
          <IconAlertCircle size={16} className="shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      ) : null}
      {success ? (
        <div className="text-xs text-enrollaa-green bg-enrollaa-green/10 border border-enrollaa-green/25 rounded-sm p-3 flex gap-2">
          <IconCheckCircle size={16} className="shrink-0" />
          <span className="break-words">{success}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="label-text">Phone</span>
          <input disabled={locked} value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
        </label>
        <label className="space-y-1.5">
          <span className="label-text">City</span>
          <input disabled={locked} value={locationCity} onChange={(event) => setLocationCity(event.target.value)} className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
        </label>
        <div className="space-y-1.5 min-w-0">
          <span className="label-text">State</span>
          <CustomSelect disabled={locked} value={locationState} onChange={setLocationState} options={NIGERIAN_STATES.map((state) => ({ value: state, label: state }))} />
        </div>
        <div className="space-y-1.5 min-w-0">
          <span className="label-text">Sex</span>
          <CustomSelect disabled={locked} value={sex} onChange={setSex} options={["Male", "Female", "Prefer not to say"].map((option) => ({ value: option, label: option }))} />
        </div>
        <label className="space-y-1.5">
          <span className="label-text">Institution</span>
          <input disabled={locked} value={institution} onChange={(event) => setInstitution(event.target.value)} className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="glass-card p-4 space-y-2 min-w-0">
          <span className="label-text">Photograph</span>
          <p className="text-xs text-enrollaa-muted-light break-words">{photo ? photo.original_filename : "No photograph uploaded"}</p>
          <input disabled={locked} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload("photo", event.target.files?.[0])} />
        </label>
        <label className="glass-card p-4 space-y-2 min-w-0">
          <span className="label-text">CV</span>
          <p className="text-xs text-enrollaa-muted-light break-words">{cv ? cv.original_filename : "No CV uploaded"}</p>
          <input disabled={locked} type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(event) => void upload("cv", event.target.files?.[0])} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5 min-w-0">
          <span className="label-text">Bank</span>
          <CustomSelect disabled={locked} value={bankName} onChange={setBankName} options={NIGERIAN_BANKS.map((bank) => ({ value: bank, label: bank }))} />
        </div>
        <label className="space-y-1.5">
          <span className="label-text">Account name</span>
          <input disabled={locked} value={accountName} onChange={(event) => setAccountName(event.target.value)} className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="label-text">Account number {data.submission?.accountLast4 ? `(saved •••• ${data.submission.accountLast4})` : ""}</span>
          <input disabled={locked} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} inputMode="numeric" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />
        </label>
      </div>

      <div className="glass-card p-4 space-y-3 text-xs text-enrollaa-muted-light whitespace-pre-wrap max-h-48 overflow-y-auto">
        {data.agreement?.content || OWNERSHIP_AGREEMENT_TEXT}
      </div>
      <label className="flex items-start gap-2 text-xs text-white">
        <input type="checkbox" disabled={locked} checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        <span>I accept the internship terms and type my name as signature.</span>
      </label>
      <input disabled={locked} value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="Typed signature" className="w-full min-w-0 bg-[#090C15] border border-white/15 text-white text-sm rounded-sm px-3 py-2.5" />

      {!locked ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" disabled={saving} onClick={() => void saveDraft()} className="btn-ghost">
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button type="button" disabled={saving} onClick={() => void submit()} className="btn-primary inline-flex items-center justify-center gap-2">
            <IconUpload size={14} />
            Submit for review
          </button>
        </div>
      ) : (
        <p className="text-xs text-enrollaa-muted-light">This onboarding record is locked while it is {data.submission?.status}.</p>
      )}
    </div>
  );
}
