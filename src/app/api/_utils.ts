import { NextResponse } from "next/server";

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}

export function apiOk<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, init);
}

export function notFound(resource = "Resource") {
  return apiError(404, "not_found", `${resource} not found.`);
}
