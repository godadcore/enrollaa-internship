import { AppProvider } from "@/lib/state";
import { dashboardIdentityFromProfile, requireDashboardRole } from "@/lib/auth/dashboard-routes";
import ManagerDashboard from "../manager/ManagerDashboard";

export default async function LeadPage() {
  const profile = await requireDashboardRole(["lead"], "/lead");
  return (
    <AppProvider trustedIdentity={dashboardIdentityFromProfile(profile)}>
      <ManagerDashboard />
    </AppProvider>
  );
}
