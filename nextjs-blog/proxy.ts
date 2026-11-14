// proxy.ts
import type { NextFetchEvent, NextRequest } from "next/server";
import { createKanorioMiddleware } from "@kanorio/sdk/edge";

const kanorioEdge = createKanorioMiddleware({
  siteUrl: process.env.NEXT_PUBLIC_KANORIO_SITE_URL!,
  serverKey: process.env.KANORIO_SERVER_KEY,
});

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return kanorioEdge.handleRequest(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
