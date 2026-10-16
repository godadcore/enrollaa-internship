"use client";

import React, { useState } from "react";
import { IconAlertCircle, IconArrowLeft, IconArrowRight, IconCheckCircle } from "@/components/icons";
import { RECOVERY_REQUEST_MESSAGE } from "@/lib/auth/recovery-copy";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setErrorMsg("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await response.json();
      if (!data.success) {
        setErrorMsg(data.error || "Unable to start password recovery.");
        return;
      }
      setSubmitted(true);
    } catch {
      setErrorMsg("Unable to start password recovery.");
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
            <h1 className="text-xl font-heading font-bold text-white tracking-tight">Password Recovery</h1>
            <p className="text-xs text-enrollaa-muted-light">Request a secure link to choose a new password.</p>
          </div>
        </div>

        <div className="bg-[#0F1424] border border-white/10 rounded-lg p-6 md:p-8 space-y-5 shadow-2xl min-w-0">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-enrollaa-green/15 border border-enrollaa-green/40 flex items-center justify-center text-enrollaa-green mx-auto">
                <IconCheckCircle size={32} />
              </div>
              <p className="text-xs text-enrollaa-muted-light leading-relaxed">{RECOVERY_REQUEST_MESSAGE}</p>
              <a href="/login" className="text-xs text-enrollaa-green hover:underline inline-flex items-center gap-1">
                <IconArrowLeft size={12} />
                Return to Sign In
              </a>
            </div>
          ) : (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label htmlFor="recovery-email" className="block text-xs font-heading font-semibold text-white mb-1.5">
                  Your Registered Email
                </label>
                <input
                  id="recovery-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@enrollaa.com.ng"
                  className="w-full min-w-0 bg-[#090C15] border border-white/15 focus:border-enrollaa-green text-white text-sm rounded-sm px-3.5 py-2.5 outline-none"
                />
              </div>
              {errorMsg && (
                <div className="text-xs text-enrollaa-red bg-enrollaa-red/10 border border-enrollaa-red/25 rounded-sm p-3 flex items-start gap-2">
                  <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="break-words">{errorMsg}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-enrollaa-green hover:bg-enrollaa-green-hover text-enrollaa-navy font-heading font-bold text-xs py-3 px-4 rounded-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? "Submitting request..." : "Request reset email"}
                {!isLoading && <IconArrowRight size={14} />}
              </button>
              <div className="pt-2 text-center">
                <a href="/login" className="text-xs text-enrollaa-muted-light hover:text-white inline-flex items-center gap-1">
                  <IconArrowLeft size={12} />
                  Return to Sign In
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
