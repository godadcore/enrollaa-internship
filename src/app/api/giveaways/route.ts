import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { cancelGiveaway, createGiveaway, executeGiveaway, internStanding, listGiveaways, updateWinnerPayment } from "@/lib/operations/giveaways";

export async function GET() {
  try {
    const profile = await getRequestTrustedProfile();
    const payload = await listGiveaways(profile);
    const standing = profile.role === "intern" ? await internStanding(profile) : null;
    return NextResponse.json({ success: true, ...payload, standing });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    if (body.action === "execute") {
      const result = await executeGiveaway(profile, typeof body.id === "string" ? body.id : "");
      return NextResponse.json({ success: true, ...result });
    }
    if (body.action === "cancel") {
      await cancelGiveaway(profile, typeof body.id === "string" ? body.id : "");
      return NextResponse.json({ success: true });
    }
    if (body.action === "payment") {
      await updateWinnerPayment(profile, body);
      return NextResponse.json({ success: true });
    }
    const result = await createGiveaway(profile, body);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
