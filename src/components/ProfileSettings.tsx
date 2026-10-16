"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useApp } from "@/lib/state";
import { getStableAvatar } from "@/lib/avatars";
import { StatusBadge, Toast } from "@/components/ui";
import { IconCheckCircle, IconEdit, IconShield, IconTrophy, IconSettings, IconSend } from "@/components/icons";

export function ProfileSettings() {
  const { currentUser, updateProfile } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [onboarding, setOnboarding] = useState<{
    status?: string;
    phone?: string;
    institution?: string;
    stateOfResidence?: string;
    accountLast4?: string | null;
    bankName?: string | null;
  } | null>(null);

  useEffect(() => {
    setPhone(currentUser.phone || "");
  }, [currentUser.phone]);

  useEffect(() => {
    if (currentUser.role !== "intern") return;
    let active = true;
    fetch("/api/onboarding/me", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!active || !response.ok || !data.success) return;
        setOnboarding({
          status: data.onboarding?.submission?.status,
          phone: data.onboarding?.submission?.phone,
          institution: data.onboarding?.submission?.institution,
          stateOfResidence: data.onboarding?.submission?.stateOfResidence,
          accountLast4: data.onboarding?.submission?.accountLast4 ?? null,
          bankName: data.onboarding?.submission?.bankName ?? null,
        });
        if (!currentUser.phone && data.onboarding?.submission?.phone) {
          setPhone(data.onboarding.submission.phone);
        }
      })
      .catch(() => {
        if (active) setOnboarding(null);
      });
    return () => {
      active = false;
    };
  }, [currentUser.role, currentUser.phone]);

  const showToastMsg = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveProfile = async () => {
    if (saving) return;
    setSaving(true);
    const result = await updateProfile({ phone });
    setSaving(false);
    if (!result.success) {
      showToastMsg(result.error || "Unable to update profile.", "error");
      return;
    }
    setIsEditing(false);
    showToastMsg("Phone number saved.");
  };

  const handleCancelEdit = () => {
    setPhone(currentUser.phone || onboarding?.phone || "");
    setIsEditing(false);
  };

  const isAdmin = currentUser.role === "super_admin" || currentUser.role === "admin";
  const isLead = currentUser.role === "manager" || currentUser.role === "lead";
  const roleLabel = isAdmin ? "Admin" : isLead ? "Department Lead" : "Intern";
  const roleBadge = isAdmin ? "badge-purple" : isLead ? "badge-amber" : "badge-green";

  return (
    <div className="space-y-6 animate-fade-in-up min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-heading font-bold text-white break-words">Profile & Settings</h2>
          <p className="text-enrollaa-muted-light text-xs md:text-sm mt-0.5">
            Identity comes from the verified session. Bank details are only shown as the last four digits from onboarding.
          </p>
        </div>
        {!isEditing ? (
          <button type="button" onClick={() => setIsEditing(true)} aria-label="Edit Profile" className="btn-secondary text-xs flex items-center gap-1.5 self-start">
            <IconEdit size={14} /> Edit Profile
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCancelEdit} className="btn-ghost text-xs" disabled={saving}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleSaveProfile()} className="btn-primary text-xs flex items-center gap-1.5" disabled={saving}>
              <IconSend size={14} /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6 space-y-6 min-w-0">
          <div className="flex items-center gap-4 pb-6 border-b border-white/5">
            <div className="w-16 h-16 rounded-full overflow-hidden relative shrink-0 border-2 border-enrollaa-green/30 bg-enrollaa-navy">
              <Image src={getStableAvatar(currentUser)} alt={currentUser.first_name} fill className="object-cover" sizes="64px" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-heading font-bold text-white break-words">
                {currentUser.first_name} {currentUser.surname}
              </h3>
              <p className="text-xs text-enrollaa-muted-light break-words">
                {currentUser.role_title}
                {currentUser.department ? ` • ${currentUser.department} Department` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`${roleBadge} text-[10px]`}>{roleLabel}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-heading font-semibold text-enrollaa-green uppercase tracking-wider">Contact</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="min-w-0">
                <label className="text-enrollaa-muted-dark uppercase font-heading text-[10px]">Email Address</label>
                <p className="text-white font-medium mt-1 font-mono break-anywhere">{currentUser.email}</p>
                <span className="text-[9px] text-enrollaa-muted-dark">(Cannot be changed)</span>
              </div>
              <div>
                <label htmlFor="profile-phone" className="text-enrollaa-muted-dark uppercase font-heading text-[10px]">Phone Number</label>
                {isEditing ? (
                  <input
                    id="profile-phone"
                    type="tel"
                    className="input-field text-xs mt-1"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+234 800 000 0000"
                  />
                ) : (
                  <p className="text-white font-medium mt-1 font-mono">{phone || "—"}</p>
                )}
              </div>
              {currentUser.role === "intern" ? (
                <>
                  <div>
                    <label className="text-enrollaa-muted-dark uppercase font-heading text-[10px]">State of Residence</label>
                    <p className="text-white font-medium mt-1">{onboarding?.stateOfResidence || "—"}</p>
                  </div>
                  <div>
                    <label className="text-enrollaa-muted-dark uppercase font-heading text-[10px]">Institution</label>
                    <p className="text-white font-medium mt-1 break-words">{onboarding?.institution || "—"}</p>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {currentUser.role === "intern" ? (
            <div className="pt-6 border-t border-white/5 space-y-3">
              <div className="flex items-center gap-2 text-white font-heading font-bold text-sm">
                <IconTrophy size={16} className="text-enrollaa-green" />
                Giveaway payout (from onboarding)
              </div>
              <p className="text-xs text-enrollaa-muted-light">
                Full account numbers are not stored on this screen. Only the last four digits from the onboarding record are shown.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-sm bg-white/[0.02] border border-white/5 text-xs">
                <div>
                  <span className="text-[10px] text-enrollaa-muted-dark uppercase font-heading">Bank</span>
                  <p className="text-white font-heading font-semibold mt-0.5">{onboarding?.bankName || "Recorded in onboarding"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-enrollaa-muted-dark uppercase font-heading">Account</span>
                  <p className="text-white font-mono font-semibold mt-0.5">
                    {onboarding?.accountLast4 ? `•••• ${onboarding.accountLast4}` : "Not submitted"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 min-w-0">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-white font-heading font-bold text-sm">
              <IconShield size={16} className="text-enrollaa-green" />
              Legal & Compliance
            </div>
            <div className="p-3.5 rounded-sm bg-white/[0.02] border border-white/5 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-enrollaa-green font-medium">
                <IconCheckCircle size={14} />
                IP Assignment Agreement
              </div>
              <p className="text-[11px] text-enrollaa-muted-light leading-relaxed">
                All code, designs, and content created during the internship belong exclusively to Enrollaa.
              </p>
              <p className="text-[10px] text-enrollaa-muted-dark">
                Onboarding status: {onboarding?.status || (currentUser.role === "intern" ? "Not submitted" : "Not applicable")}
              </p>
            </div>
            <div className="p-3.5 rounded-sm bg-white/[0.02] border border-white/5 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-enrollaa-purple font-medium">
                <IconSettings size={14} />
                Account Information
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-enrollaa-muted-light">Role</span>
                  <span className={`${roleBadge} text-[10px]`}>{roleLabel}</span>
                </div>
                {currentUser.department ? (
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-enrollaa-muted-light">Department</span>
                    <span className="text-white font-medium text-right break-words">{currentUser.department}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-enrollaa-muted-light">Status</span>
                  <StatusBadge status="account_activated" />
                </div>
              </div>
            </div>
          </div>
          <div className="glass-card p-5 text-xs space-y-2">
            <p className="text-enrollaa-muted-light leading-relaxed">
              <strong className="text-white">Enrollaa Internship Programme 2026</strong>
              <br />
              Official website: <strong>enrollaa.com.ng</strong>
              <br />
              Timezone: Africa/Lagos (WAT, UTC+1)
            </p>
          </div>
        </div>
      </div>

      <Toast message={toast?.message || ""} type={toast?.type} visible={!!toast} />
    </div>
  );
}
