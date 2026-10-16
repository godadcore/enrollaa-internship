import { AppProvider } from "@/lib/state";
import { dashboardPathForRole, getDashboardProfile } from "@/lib/auth/dashboard-routes";
import { AuthorizationError } from "@/lib/auth/authorization";
import LoginScreen from "@/components/LoginScreen";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  try {
    const profile = await getDashboardProfile();
    redirect(dashboardPathForRole(profile.role));
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    // Login is the correct destination for absent, expired, or unprovisioned sessions.
  }
  return (
    <AppProvider>
      <LoginScreen />
    </AppProvider>
  );
}
