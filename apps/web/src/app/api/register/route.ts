import { NextResponse } from "next/server";

// Proxies sign-up requests to the ws-server, which owns the database. Kept as a
// same-origin route so the browser never talks to the API host directly for
// registration (avoids CORS and keeps the API base URL server-side).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid request body" } },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await res.json()) as unknown;
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "NETWORK_ERROR", message: "Could not reach the authentication server." },
      },
      { status: 502 },
    );
  }
}
