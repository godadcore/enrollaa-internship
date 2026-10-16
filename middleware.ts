import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { assertSameOrigin } from "@/lib/auth/csrf";

export async function middleware(request: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    try {
      assertSameOrigin(request);
    } catch {
      return NextResponse.json({ success: false, error: "The request origin is not allowed." }, { status: 403 });
    }
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|avatars/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
