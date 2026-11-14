// app/api/draft/route.ts
import { draftMode } from "next/headers";
import { createPreviewRouteHandler } from "@kanorio/sdk/preview";

export const GET = createPreviewRouteHandler({
  siteUrl: process.env.NEXT_PUBLIC_KANORIO_SITE_URL,
  enableDraftMode: async () => (await draftMode()).enable(),
});
