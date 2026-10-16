"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertCircle,
  IconArrowRight,
  IconCheckCircle,
  IconEye,
  IconEyeOff,
  IconShield,
} from "@/components/icons";
import { passwordRequirementState, validateAccountPassword } from "@/lib/auth/password-rules";

type InvitationPreview = {
  firstName: string;
  surname: string;
  email: string;
  roleTitle: string;
  department: string;
};

export function InvitationActivationForm({ initialToken = "" }: { initialToken?: string }) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(Boolean(initialToken));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);

  const requirements = passwordRequirementState(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = validateAccountPassword(password) === null && passwordsMatch;

  async function verifyToken(value: string) {
    const clean = value.trim();
    if (!clean) {
      setInvitation(null);
      setErrorMessage("Enter the invitation token from your email.");
      return;
    }
    setIsVerifying(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/invitations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: clean }),
      });
      const data = await response.json();
      if (!data.valid || !data.invitation) {
        setInvitation(null);
        setErrorMessage(data.error || "This invitation is invalid, expired, revoked, or already used.");
        return;
      }
      setInvitation(data.invitation);
      setToken(clean);
    } catch {
      setInvitation(null);
      setErrorMessage("Unable to verify this invitation. Try again.");
    } finally {
      setIsVerifying(false);
    }
  }

  useEffect(() => {
    if (initialToken) void verifyToken(initialToken);
    // Initial token is read once from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    await verifyToken(token);
  };

  const handleActivate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invitation || !isFormValid || isSubmitting) return;
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/create-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: invitation.email,
          password,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        setErrorMessage(data.error || "Unable to activate this invitation.");
        return;
      }
      setIsSuccess(true);
    } catch {
      setErrorMessage("Unable to activate this invitation. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-enrollaa-navy flex flex-col items-center justify-center p-4 relative">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[min(100%,31.25rem)] h-[18.75rem] bg-enrollaa-green/5 rounded-full blur-[80px]" />
      </div>
      <div className="w-full max-w-md min-w-0 relative z-10 space-y-6">
        <div className="text-center space-y-3">
          <a href="/" className="inline-block">
            <img src="/brand/Logo1.svg" alt="Enrollaa Logo" className="h-9 w-auto mx-auto" />
          </a>
          <div className="space-y-1">
            <h1 className="text-xl font-heading font-bold text-white tracking-tight">Accept your invitation</h1>
            <p className="text-xs text-enrollaa-muted-light">
              Create a password to activate your Enrollaa Internship account.
            </p>
          </div>
        </div>

        <div className="bg-[#0F1424] border border-white/10 rounded-lg p-6 md:p-8 space-y-5 shadow-2xl min-w-0">
          {isVerifying && !invitation && !errorMessage ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-6 h-6 border-2 border-enrollaa-green border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-enrollaa-muted-light">Verifying invitation...</p>
            </div>
          ) : isSuccess ? (
            <div className="text-center space-y-5 py-2">
              <div className="w-14 h-14 rounded-full bg-enrollaa-green/15 border border-enrollaa-green/40 flex items-center justify-center text-enrollaa-green mx-auto">
                <IconCheckCircle size={32} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-heading font-bold text-white">Account activated</h2>
                <p className="text-xs text-enrollaa-muted-light leading-relaxed">
                  Your password is set. Sign in with your registered email to open your workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full bg-enrollaa-green hover:bg-enrollaa-green-hover text-enrollaa-navy font-heading font-bold text-xs py-3 px-4 rounded-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-glow-green"
              >
                <span>Proceed to Sign In</span>
                <IconArrowRight size={14} />
              </button>
            </div>
          ) : !invitation ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="invitation-token" className="block text-xs font-heading font-semibold text-white mb-1.5">
                  Invitation token
                </label>
                <input
                  id="invitation-token"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste the token from your invitation email"
                  className="w-full min-w-0 bg-[#090C15] border border-white/15 focus:border-enrollaa-green text-white text-sm rounded-sm px-3.5 py-2.5 outline-none"
                  autoComplete="off"
                />
              </div>
              {errorMessage && (
                <div className="text-xs text-enrollaa-red bg-enrollaa-red/10 border border-enrollaa-red/25 rounded-sm p-3 flex items-start gap-2">
                  <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed break-words">{errorMessage}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full bg-enrollaa-green hover:bg-enrollaa-green-hover text-enrollaa-navy font-heading font-bold text-xs py-3 px-4 rounded-sm disabled:opacity-50"
              >
                {isVerifying ? "Verifying..." : "Verify invitation"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleActivate} className="space-y-4 min-w-0">
              <div className="p-3 bg-white/[0.03] border border-white/5 rounded-sm text-xs space-y-1 min-w-0">
                <div className="text-white font-medium break-words">
                  {invitation.firstName} {invitation.surname}
                </div>
                <div className="text-enrollaa-green font-mono text-[11px] break-all">{invitation.email}</div>
                <div className="text-enrollaa-muted-light break-words">
                  {invitation.roleTitle} · {invitation.department}
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-semibold text-white mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full min-w-0 bg-[#090C15] border border-white/15 focus:border-enrollaa-green text-white text-sm rounded-sm px-3.5 py-2.5 pr-10 outline-none"
                  />
                  <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-enrollaa-muted-light p-1">
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-semibold text-white mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full min-w-0 bg-[#090C15] border border-white/15 focus:border-enrollaa-green text-white text-sm rounded-sm px-3.5 py-2.5 pr-10 outline-none"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-enrollaa-muted-light p-1">
                    {showConfirmPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-sm space-y-1.5 text-[11px]">
                <span className="text-enrollaa-muted-dark uppercase tracking-wider text-[10px] block font-heading">
                  Password Requirements
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-enrollaa-muted-light">
                  <div className={requirements.hasMinLength ? "text-enrollaa-green" : ""}>At least 8 characters</div>
                  <div className={requirements.hasUppercase ? "text-enrollaa-green" : ""}>Uppercase letter</div>
                  <div className={requirements.hasLowercase ? "text-enrollaa-green" : ""}>Lowercase letter</div>
                  <div className={requirements.hasNumber ? "text-enrollaa-green" : ""}>At least one number</div>
                </div>
                {password.length > 0 && confirmPassword.length > 0 && (
                  <div className={passwordsMatch ? "text-enrollaa-green" : "text-enrollaa-red"}>
                    {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="text-xs text-enrollaa-red bg-enrollaa-red/10 border border-enrollaa-red/25 rounded-sm p-3 flex items-start gap-2">
                  <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed break-words">{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="w-full bg-enrollaa-green hover:bg-enrollaa-green-hover text-enrollaa-navy font-heading font-bold text-xs py-3 px-4 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Activating account..." : "Create password and activate"}
              </button>
              <p className="text-[11px] text-enrollaa-muted-dark flex items-start gap-1.5">
                <IconShield size={12} className="shrink-0 mt-0.5" />
                <span>Role and department come from your invitation. Browser changes cannot grant extra access.</span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
