// app/auth/callback/route.ts
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeHostedLoginCode, visitorIpFromRequest } from "@kanorio/sdk";

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || state !== jar.get("kanorio_state")?.value) return new NextResponse("Invalid sign-in state", { status: 400 });

  const grant = await exchangeHostedLoginCode({
    siteUrl: process.env.NEXT_PUBLIC_KANORIO_SITE_URL!,
    clientId: process.env.KANORIO_SITE_ID!,
    code,
    codeVerifier: jar.get("kanorio_verifier")!.value,
    redirectUri: `${request.nextUrl.origin}/auth/callback`,
    serverKey: process.env.KANORIO_SERVER_KEY,
    visitorIp: visitorIpFromRequest(request),
  });

  jar.set("kanorio_customer", grant.accessToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: grant.expiresIn });
  return NextResponse.redirect(new URL("/account", request.url));
}
