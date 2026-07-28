import { SignJWT } from "jose";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Mints a short-lived HS256 JWT that the ws-server can verify. The ws-server
// authenticates WebSocket connections with `jwt.verify(token, NEXTAUTH_SECRET)`
// and reads the user id from the `sub` claim, so we sign with the same secret.
//
// IMPORTANT: the web app's AUTH_SECRET must equal the ws-server's
// NEXTAUTH_SECRET for these tokens to validate.
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
      { status: 401 },
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "CONFIG_ERROR", message: "AUTH_SECRET is not configured" },
      },
      { status: 500 },
    );
  }

  const token = await new SignJWT({
    sub: userId,
    name: session.user?.name ?? undefined,
    email: session.user?.email ?? undefined,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ success: true, data: { token } });
}
