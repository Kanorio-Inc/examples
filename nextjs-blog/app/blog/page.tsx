// app/blog/page.tsx
import Link from "next/link";
import { cacheTag } from "@kanorio/sdk";
import { kanorio } from "@/lib/kanorio";
import type { KanorioCollectionsMap } from "@/types/kanorio";

export default async function BlogIndex() {
  const page = await kanorio<KanorioCollectionsMap["blog"]["list"]>(
    "/collections/blog/items?sort=-publishedAt&limit=20&fields=title,excerpt",
    [cacheTag.collection("blog")]
  );
  return (
    <ul>
      {page?.data.map((post) => (
        <li key={post.id}>
          <Link href={post.path ?? `/blog/${post.slug}`}>{post.fieldData.title}</Link>
        </li>
      ))}
    </ul>
  );
}
