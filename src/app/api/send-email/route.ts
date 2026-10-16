import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Server-side email dispatch is not enabled until the persistent invitation and activation workflows are implemented." },
    { status: 503 }
  );
}
