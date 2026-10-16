import { AppProvider } from "@/lib/state";
import { dashboardIdentityFromProfile, requireDashboardRole } from "@/lib/auth/dashboard-routes";
import InternPortal from "./InternPortal";

export default async function Page() {
  const profile = await requireDashboardRole(["intern"], "/portal");
  return (
    <AppProvider trustedIdentity={dashboardIdentityFromProfile(profile)}>
      <InternPortal />
    </AppProvider>
  );
}
