import { NextResponse } from "next/server";
import { privilegedDatabase } from "@/lib/data/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await privilegedDatabase().from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    if (error) {
      return NextResponse.json({ success: false, status: "degraded", database: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ success: true, status: "ok", database: "available" });
  } catch {
    return NextResponse.json({ success: false, status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
