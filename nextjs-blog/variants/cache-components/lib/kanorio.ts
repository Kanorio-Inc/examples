// lib/kanorio.ts
import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { frameworkCacheTags } from "@kanorio/sdk";

const SITE_URL = process.env.NEXT_PUBLIC_KANORIO_SITE_URL!;

export async function kanorio<T>(path: string): Promise<T | null> {
  "use cache";
  cacheLife("hours");
  const { isEnabled: isDraft } = await draftMode();
  const url = new URL(`/api/v1${path}`, SITE_URL);
  if (isDraft) url.searchParams.set("preview", "1");

  const res = await fetch(url, isDraft ? { headers: { "X-Kanorio-Preview": process.env.KANORIO_PREVIEW_TOKEN! } } : undefined);
  // The response lists what it used; tag after the read
  cacheTag(...frameworkCacheTags(res.headers));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Kanorio ${res.status} for ${path}`);
  return (await res.json()) as T;
}
