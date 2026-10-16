import "server-only";

import { cookies } from "next/headers";
import { requireAdmin, requireRoles, getTrustedProfile, type EnrollaaRole, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";
import { createSupabaseSessionClient } from "@/lib/supabase/session-server";

export async function cookieSessionClient() {
  return createSupabaseSessionClient(await cookies());
}

export async function getRequestTrustedProfile(): Promise<TrustedProfile> {
  return getTrustedProfile(await cookieSessionClient());
}

export async function requireApiRoles(allowedRoles: readonly EnrollaaRole[]): Promise<TrustedProfile> {
  return requireRoles(await cookieSessionClient(), allowedRoles);
}

export async function requireApiAdmin(): Promise<TrustedProfile> {
  return requireAdmin(await cookieSessionClient());
}

export async function readJsonBody(request: Request, invalidMessage = "Request details are required."): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new DataAccessError(invalidMessage, 400);
  }
}
