"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/state";
import { IconArrowRight, IconAlertCircle, IconEye, IconEyeOff } from "@/components/icons";

export default function LoginScreen() {
  const { loginWithPassword } = useApp();
  const router = useRouter();
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    if (!passwordInput) {
      setError("Please enter your account password.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await loginWithPassword(cleanEmail, passwordInput);
      if (!result.success) {
        setError(result.error || "Invalid credentials. Please verify and try again.");
      } else if (result.role === "admin" || result.role === "super_admin") {
        router.replace("/admin");
      } else if (result.role === "manager") {
        router.replace("/manager");
      } else if (result.role === "lead") {
        router.replace("/lead");
      } else if (result.role === "intern") {
        router.replace("/portal");
      } else {
        setError("Your account does not have an authorized dashboard role.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during sign-in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-enrollaa-navy flex flex-col items-center justify-center p-4 relative">
      {/* Subtle brand ambient glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[min(100%,34rem)] h-[18.75rem] bg-enrollaa-green/10 rounded-full blur-[80px]" />
      </div>

      <div className="w-full max-w-md min-w-0 relative z-10 space-y-6">
        {/* Real Brand Logo & Title */}
        <div className="text-center space-y-3">
          <div className="inline-block">
            <img
              src="/brand/Logo1.svg"
              alt="Enrollaa Logo"
              className="h-9 w-auto mx-auto"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-heading font-bold text-white tracking-tight">
              Internship Management Workspace
            </h1>
            <p className="text-xs text-enrollaa-muted-light">
              Invitation-only access for interns, department leads, and administrators.
            </p>
          </div>
        </div>

        {/* Card Surface */}
        <div className="bg-enrollaa-navy-light border border-enrollaa-green/20 rounded-lg p-6 md:p-8 space-y-5 shadow-[0_24px_60px_rgba(5,0,35,0.45)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-heading font-semibold text-white mb-1.5"
              >
                Registered Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="name@enrollaa.com.ng"
                className="w-full bg-enrollaa-navy border border-white/15 focus:border-enrollaa-green text-white text-sm rounded-sm px-3.5 py-2.5 outline-none transition-colors placeholder:text-enrollaa-muted-dark"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-heading font-semibold text-white"
                >
                  Password
                </label>
                <a
                  href="/forgot-password"
                  className="text-[11px] text-enrollaa-green hover:underline focus:outline-none"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-enrollaa-navy border border-white/15 focus:border-enrollaa-green text-white text-sm rounded-sm px-3.5 py-2.5 pr-10 outline-none transition-colors placeholder:text-enrollaa-muted-dark"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-enrollaa-muted-light hover:text-white p-1 focus:outline-none transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-enrollaa-red bg-enrollaa-red/10 border border-enrollaa-red/25 rounded-sm p-3 flex items-start gap-2 animate-fade-in">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5 text-enrollaa-red" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-enrollaa-green hover:bg-enrollaa-green-hover text-enrollaa-navy font-heading font-bold text-xs py-3 px-4 rounded-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-glow-green disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-enrollaa-navy border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <IconArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Invitation Notice */}
          <div className="pt-4 border-t border-white/10 text-center space-y-2">
            <p className="text-[11px] text-enrollaa-muted-light leading-relaxed">
              Access is available to invited programme members only.
            </p>
            <p className="text-[11px] text-enrollaa-muted-dark">
              Have an invitation?{" "}
              <a href="/onboarding" className="text-enrollaa-green hover:underline">
                Enter your invitation token
              </a>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-enrollaa-muted-dark space-y-1">
          <div>Authoritative Timezone: Africa/Lagos (WAT, UTC+1)</div>
          <div>© 2026 Enrollaa · Proprietary &amp; Confidential</div>
        </div>
      </div>
    </div>
  );
}
