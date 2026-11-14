// lib/kanorio.ts
import { draftMode } from "next/headers";
import { prefixCacheTags } from "@kanorio/sdk";

const SITE_URL = process.env.NEXT_PUBLIC_KANORIO_SITE_URL!;

export async function kanorio<T>(path: string, tags: string[]): Promise<T | null> {
  const { isEnabled: isDraft } = await draftMode();
  const url = new URL(`/api/v1${path}`, SITE_URL);
  if (isDraft) url.searchParams.set("preview", "1");

  const res = await fetch(
    url,
    isDraft
      ? { headers: { "X-Kanorio-Preview": process.env.KANORIO_PREVIEW_TOKEN! }, cache: "no-store" }
      : { next: { tags: prefixCacheTags(tags), revalidate: 3600 } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Kanorio ${res.status} for ${path}`);
  return (await res.json()) as T;
}
