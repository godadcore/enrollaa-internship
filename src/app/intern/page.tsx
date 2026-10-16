import { AppProvider } from "@/lib/state";
import { dashboardIdentityFromProfile, requireDashboardRole } from "@/lib/auth/dashboard-routes";
import InternPortal from "../portal/InternPortal";

export default async function InternPage() {
  const profile = await requireDashboardRole(["intern"], "/intern");
  return (
    <AppProvider trustedIdentity={dashboardIdentityFromProfile(profile)}>
      <InternPortal />
    </AppProvider>
  );
}
