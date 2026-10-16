"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/ui";
import { ProfileSettings } from "@/components/ProfileSettings";
import { InternOnboardingPanel } from "@/components/InternOnboardingPanel";
import { InternHomePanel } from "@/components/operations/InternHomePanel";
import { AttendancePanel } from "@/components/operations/AttendancePanel";
import { TasksPanel } from "@/components/operations/TasksPanel";
import { GiveawaysPanel } from "@/components/operations/GiveawaysPanel";

export default function InternPortal() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <DashboardShell activeSection={activeSection} onSectionChange={setActiveSection}>
      {activeSection === "overview" && <InternHomePanel onNavigate={setActiveSection} />}
      {activeSection === "onboarding" && <InternOnboardingPanel />}
      {activeSection === "attendance" && <AttendancePanel mode="intern" />}
      {activeSection === "tasks" && <TasksPanel mode="intern" />}
      {activeSection === "giveaways" && <GiveawaysPanel mode="intern" />}
      {activeSection === "profile" && <ProfileSettings />}
    </DashboardShell>
  );
}
