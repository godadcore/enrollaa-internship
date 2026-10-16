import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { listWeeklyReports, reviewWeeklyReport, saveWeeklyReport, submitWeeklyReport } from "@/lib/operations/reports";

export async function GET() {
  try {
    const profile = await getRequestTrustedProfile();
    return NextResponse.json({ success: true, reports: await listWeeklyReports(profile) });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    if (body.action === "submit") {
      await submitWeeklyReport(profile, typeof body.id === "string" ? body.id : "");
      return NextResponse.json({ success: true });
    }
    if (body.action === "review") {
      await reviewWeeklyReport(profile, body);
      return NextResponse.json({ success: true });
    }
    const result = await saveWeeklyReport(profile, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
