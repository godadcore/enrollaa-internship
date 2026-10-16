import { AppProvider } from "@/lib/state";
import { dashboardIdentityFromProfile, requireDashboardRole } from "@/lib/auth/dashboard-routes";
import AdminDashboard from "./AdminDashboard";

export default async function Page() {
  const profile = await requireDashboardRole(["admin", "super_admin"], "/admin");
  return (
    <AppProvider trustedIdentity={dashboardIdentityFromProfile(profile)}>
      <AdminDashboard />
    </AppProvider>
  );
}
