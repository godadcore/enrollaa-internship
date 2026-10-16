"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  IconAlertCircle,
  IconArrowRight,
  IconCheckCircle,
  IconEye,
  IconEyeOff,
} from "@/components/icons";
import { passwordRequirementState, validateAccountPassword } from "@/lib/auth/password-rules";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    linkError ? "This reset link is invalid or has expired. Request a new password reset email." : "",
  );
  const [success, setSuccess] = useState(false);

  const requirements = passwordRequirementState(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = validateAccountPassword(password) === null && passwordsMatch;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isFormValid || isLoading) return;
    setErrorMsg("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!data.success) {
        setErrorMsg(data.error || "Unable to update the password.");
        return;
      }
      setSuccess(true);
    } catch {
      setErrorMsg("Unable to update the password.");
    } finally {
      setIsLoading(false);
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
            <h1 className="text-xl font-heading font-bold text-white tracking-tight">Choose a new password</h1>
            <p className="text-xs text-enrollaa-muted-light">This does not change your role or department assignment.</p>
          </div>
        </div>
        <div className="bg-[#0F1424] border border-white/10 rounded-lg p-6 md:p-8 space-y-5 shadow-2xl min-w-0">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-enrollaa-green/15 border border-enrollaa-green/40 flex items-center justify-center text-enrollaa-green mx-auto">
                <IconCheckCircle size={32} />
              </div>
              <p className="text-xs text-enrollaa-muted-light leading-relaxed">
                Your password was updated. Sign in with your email and new password.
              </p>
              <a
                href="/login"
                className="w-full bg-enrollaa-green hover:bg-enrollaa-green-hover text-enrollaa-navy font-heading font-bold text-xs py-3 px-4 rounded-sm inline-flex items-center justify-center gap-2"
              >
                Proceed to Sign In
                <IconArrowRight size={14} />
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-heading font-semibold text-white mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
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
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full min-w-0 bg-[#090C15] border border-white/15 focus:border-enrollaa-green text-white text-sm rounded-sm px-3.5 py-2.5 pr-10 outline-none"
                  />
                  <button type="button" onClick={() => setShowConfirm((prev) => !prev)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-enrollaa-muted-light p-1">
                    {showConfirm ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-enrollaa-muted-light">
                <div className={requirements.hasMinLength ? "text-enrollaa-green" : ""}>At least 8 characters</div>
                <div className={requirements.hasUppercase ? "text-enrollaa-green" : ""}>Uppercase letter</div>
                <div className={requirements.hasLowercase ? "text-enrollaa-green" : ""}>Lowercase letter</div>
                <div className={requirements.hasNumber ? "text-enrollaa-green" : ""}>At least one number</div>
              </div>
              {errorMsg && (
                <div className="text-xs text-enrollaa-red bg-enrollaa-red/10 border border-enrollaa-red/25 rounded-sm p-3 flex items-start gap-2">
                  <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="break-words">{errorMsg}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full bg-enrollaa-green hover:bg-enrollaa-green-hover text-enrollaa-navy font-heading font-bold text-xs py-3 px-4 rounded-sm disabled:opacity-50"
              >
                {isLoading ? "Updating password..." : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-enrollaa-navy flex items-center justify-center text-white text-xs">
          Loading password reset...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
