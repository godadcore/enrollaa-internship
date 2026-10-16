import { dashboardPathForRole, getDashboardProfile } from "@/lib/auth/dashboard-routes";
import { AuthorizationError } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";

export default async function Page() {
  try {
    const profile = await getDashboardProfile();
    redirect(dashboardPathForRole(profile.role));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/login");
    throw error;
  }
}
