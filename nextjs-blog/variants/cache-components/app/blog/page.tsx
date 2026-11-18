// app/blog/page.tsx
import Link from "next/link";
import { image } from "@kanorio/sdk";
import { KanorioImage } from "@/components/kanorio-image";
import { kanorio } from "@/lib/kanorio";
import type { KanorioCollectionsMap } from "@/types/kanorio";

export default async function BlogIndex() {
  const page = await kanorio<KanorioCollectionsMap["blog"]["list"]>(
    "/collections/blog/items?sort=-publishedAt&limit=20&fields=title,excerpt,cover_image,share_image"
  );
  return (
    <ul>
      {page?.data.map((post) => {
        // The cover the author picked. A post without one shows its share image,
        // unless that is the title card Kanorio generates: it repeats the title the card already shows
        const cover = image.resolve(post.fieldData.cover_image, page.assets);
        const share = post.fieldData.share_image;
        const picture = cover ?? (share && share.source !== "title_card" ? image.resolve(share.url, null, { alt: share.alt }) : undefined);
        return (
          <li key={post.id}>
            {picture && (
              // A 16:9 card: CSS crops the image around the owner's focal point
              <div style={{ position: "relative", aspectRatio: "16 / 9" }}>
                <KanorioImage image={picture} fill fit="cover" sizes="(min-width: 768px) 33vw, 100vw" />
              </div>
            )}
            <Link href={post.path ?? `/blog/${post.slug}`}>{post.fieldData.title}</Link>
          </li>
        );
      })}
    </ul>
  );
}
