import { NextResponse } from "next/server";
import { requestPasswordRecovery } from "@/lib/auth/password-recovery";
import { readJsonBody } from "@/lib/data/request";

export async function POST(request: Request) {
  let email: unknown = "";
  try {
    const body = await readJsonBody(request);
    if (body && typeof body === "object") email = (body as { email?: unknown }).email;
  } catch {
    email = "";
  }
  const result = await requestPasswordRecovery(email);
  return NextResponse.json(result);
}
