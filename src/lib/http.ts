import { NextResponse } from "next/server";

/**
 * Shared response helpers. Every endpoint answers with the same envelope:
 * success → { "data": ... }   |   failure → { "error": "...", "details": [...] }
 */
export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function fail(error: string, status = 400, details?: string[]): NextResponse {
  return NextResponse.json(
    { error, ...(details && details.length > 0 ? { details } : {}) },
    { status }
  );
}
