// app/blog/page.tsx
import Link from "next/link";
import { image } from "@kanorio/sdk";
import { kanorio } from "@/lib/kanorio";
import type { KanorioCollectionsMap } from "@/types/kanorio";

export default async function BlogIndex() {
  const page = await kanorio<KanorioCollectionsMap["blog"]["list"]>(
    "/collections/blog/items?sort=-publishedAt&limit=20&fields=title,excerpt,cover_image,share_image"
  );
  return (
    <ul>
      {page?.data.map((post) => {
        // The cover the author picked, resized for a card. A post without one shows its share image (1200x630, ready to use)
        const cover = image.resolve(post.fieldData.cover_image, page.assets);
        const src = cover ? image.url(cover.url, { width: 800 }) : post.fieldData.share_image?.url;
        return (
          <li key={post.id}>
            {src && <img src={src} alt={cover?.alt ?? ""} loading="lazy" />}
            <Link href={post.path ?? `/blog/${post.slug}`}>{post.fieldData.title}</Link>
          </li>
        );
      })}
    </ul>
  );
}
