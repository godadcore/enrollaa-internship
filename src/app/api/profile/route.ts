import { NextResponse } from "next/server";
import { jsonErrorResponse, DataAccessError } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { privilegedDatabase } from "@/lib/data/database";
import { recordSensitiveAudit } from "@/lib/data/audit";

export async function PATCH(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 32) : "";
    if (!phone) throw new DataAccessError("Enter a phone number.", 400);
    const digitCount = phone.replace(/\D/g, "").length;
    if (digitCount < 10 || digitCount > 15) {
      throw new DataAccessError("Enter a valid phone number with 10 to 15 digits.", 400);
    }

    const { error } = await privilegedDatabase()
      .from("profiles")
      .update({ phone, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) throw new DataAccessError("Unable to update profile.", 500);

    await recordSensitiveAudit({
      actor: profile,
      action: "profile_phone_updated",
      targetType: "profile",
      targetId: profile.id,
    });

    return NextResponse.json({ success: true, phone });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
