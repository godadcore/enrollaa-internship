import "server-only";

import { AuthorizationError, type TrustedProfile } from "./authorization";
import { DataAccessError, describeDataAccessError } from "@/lib/data/errors";
import { readJsonBody as readRequestJson, requireApiAdmin } from "@/lib/data/request";

export async function getAdminApiProfile(): Promise<TrustedProfile> {
  return requireApiAdmin();
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await readRequestJson(request, "Invitation details are required.");
  } catch (error) {
    if (error instanceof DataAccessError) throw error;
    throw new DataAccessError("Invitation details are required.", 400);
  }
}

export function adminApiError(error: unknown): { status: number; message: string } {
  if (error instanceof AuthorizationError) return { status: error.status, message: error.message };
  return describeDataAccessError(error, "Unable to process the invitation request.");
}
