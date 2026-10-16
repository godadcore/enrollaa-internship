import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile } from "@/lib/data/request";
import { privilegedDatabase } from "@/lib/data/database";
import { DataAccessError } from "@/lib/data/errors";
import { OFFICIAL_INTERNSHIP_ROLES } from "@/lib/internship-roles";

export async function GET() {
  try {
    await getRequestTrustedProfile();
    const { data, error } = await privilegedDatabase()
      .from("internship_roles")
      .select("slug, name, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new DataAccessError("Unable to load internship roles.", 500);
    const roles = (data ?? []).map((row) => ({ slug: row.slug, name: row.name, sortOrder: row.sort_order }));
    return NextResponse.json({
      success: true,
      roles: roles.length ? roles : OFFICIAL_INTERNSHIP_ROLES.map((role) => ({ slug: role.slug, name: role.name, sortOrder: role.sortOrder })),
    });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
