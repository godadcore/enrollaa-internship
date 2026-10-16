"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/ui";
import { ProfileSettings } from "@/components/ProfileSettings";
import { OnboardingReviewPanel } from "@/components/OnboardingReviewPanel";
import { LeadHomePanel } from "@/components/operations/LeadHomePanel";
import { TeamPanel } from "@/components/operations/TeamPanel";
import { AttendancePanel } from "@/components/operations/AttendancePanel";
import { TasksPanel } from "@/components/operations/TasksPanel";
import { ReportsPanel } from "@/components/operations/ReportsPanel";
import { GiveawaysPanel } from "@/components/operations/GiveawaysPanel";

export default function ManagerDashboard() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <DashboardShell activeSection={activeSection} onSectionChange={setActiveSection}>
      {activeSection === "overview" && <LeadHomePanel onNavigate={setActiveSection} />}
      {activeSection === "onboarding" && <OnboardingReviewPanel />}
      {activeSection === "team" && <TeamPanel />}
      {activeSection === "attendance" && <AttendancePanel mode="staff" />}
      {activeSection === "tasks" && <TasksPanel mode="staff" />}
      {activeSection === "reports" && <ReportsPanel mode="lead" />}
      {activeSection === "giveaways" && <GiveawaysPanel mode="intern" />}
      {activeSection === "profile" && <ProfileSettings />}
    </DashboardShell>
  );
}
