import { AppProvider } from "@/lib/state";
import { dashboardIdentityFromProfile, requireDashboardRole } from "@/lib/auth/dashboard-routes";
import ManagerDashboard from "./ManagerDashboard";

export default async function Page() {
  const profile = await requireDashboardRole(["manager"], "/manager");
  return (
    <AppProvider trustedIdentity={dashboardIdentityFromProfile(profile)}>
      <ManagerDashboard />
    </AppProvider>
  );
}
