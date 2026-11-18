// app/blog/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheTag, image, seoMetadata } from "@kanorio/sdk";
import { toNextMetadata } from "@kanorio/sdk/next";
import { KanorioImage } from "@/components/kanorio-image";
import { kanorio } from "@/lib/kanorio";
import type { KanorioCollectionsMap } from "@/types/kanorio";

function loadPost(slug: string) {
  // A post is read by slug, so its `item:<id>` tag is not known before the fetch. Tag it with the collection:
  // every change to a post is sent with `collection:blog`. A change to one post refreshes each post page on its next visit.
  return kanorio<KanorioCollectionsMap["blog"]["single"]>(
    `/collections/blog/items/${encodeURIComponent(slug)}?expand=authors,categories&formats=html`,
    [cacheTag.collection("blog")]
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await loadPost((await params).slug);
  if (!data) return {};
  // Title, description, canonical, robots and the share image, by the rules the hosted site uses.
  // The share image is `fieldData.share_image`: Kanorio has picked it and cropped it the way the author framed it
  return toNextMetadata(seoMetadata(data.item));
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadPost(slug);
  if (!data) notFound();

  const { item, assets } = data;
  // The cover is optional. It is an asset id: `assets` has its URL, size, alt text and blurred preview
  const cover = image.resolve(item.fieldData.cover_image, assets);
  return (
    <article>
      <h1>{item.fieldData.title}</h1>
      {cover && <KanorioImage image={cover} sizes="(min-width: 800px) 768px, 100vw" style={{ width: "100%", height: "auto" }} />}
      {item.contentHtml && <div dangerouslySetInnerHTML={{ __html: item.contentHtml }} />}
    </article>
  );
}
