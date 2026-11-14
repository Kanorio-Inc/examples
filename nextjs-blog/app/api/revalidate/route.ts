// app/api/revalidate/route.ts
import { revalidateTag } from "next/cache";
import { createRevalidateHandler } from "@kanorio/sdk";

export const POST = createRevalidateHandler({
  signingSecret: process.env.KANORIO_WEBHOOK_SECRET!,
  revalidateTag: (tag) => revalidateTag(tag, "max"),
});
