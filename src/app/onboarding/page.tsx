"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InvitationActivationForm } from "@/components/InvitationActivationForm";

function OnboardingContent() {
  const token = useSearchParams().get("token") || "";
  return <InvitationActivationForm initialToken={token} />;
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-enrollaa-navy flex items-center justify-center text-white text-xs">
          Loading invitation...
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
