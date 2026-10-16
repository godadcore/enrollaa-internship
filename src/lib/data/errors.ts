import "server-only";

import { NextResponse } from "next/server";
import { AuthorizationError } from "@/lib/auth/authorization";

/** Sanitized application error for API and data-access failures. */
export class DataAccessError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

export function describeDataAccessError(
  error: unknown,
  fallback = "Unable to process the request.",
): { status: number; message: string } {
  if (error instanceof AuthorizationError) return { status: error.status, message: error.message };
  if (error instanceof DataAccessError) return { status: error.status, message: error.message };
  return { status: 500, message: fallback };
}

export function jsonErrorResponse(error: unknown, fallback?: string): NextResponse {
  const result = describeDataAccessError(error, fallback);
  return NextResponse.json({ success: false, error: result.message }, { status: result.status });
}
