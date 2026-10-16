import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile } from "@/lib/data/request";
import { AuthorizationError } from "@/lib/auth/authorization";
import { privilegedDatabase } from "@/lib/data/database";
import { DataAccessError } from "@/lib/data/errors";
import { isProgrammeWideRole } from "@/lib/data/scope";

export async function GET() {
  try {
    const profile = await getRequestTrustedProfile();
    if (!isProgrammeWideRole(profile.role)) throw new AuthorizationError("You do not have access to this resource.", 403);
    const { data, error } = await privilegedDatabase()
      .from("audit_logs")
      .select("id, action, target_type, created_at, actor_profile_id, profiles!audit_logs_actor_profile_id_fkey(first_name, surname, role)")
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new DataAccessError("Unable to load audit records.", 500);
    return NextResponse.json({
      success: true,
      logs: (data ?? []).map((row) => {
        const actor = Array.isArray(row.profiles) ? row.profiles[0] : (row.profiles as { first_name?: string; surname?: string; role?: string } | null);
        return {
          id: row.id,
          action: row.action,
          targetType: row.target_type,
          createdAt: row.created_at,
          actorName: actor ? `${actor.first_name} ${actor.surname}` : "System",
          actorRole: actor?.role ?? "",
        };
      }),
    });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
