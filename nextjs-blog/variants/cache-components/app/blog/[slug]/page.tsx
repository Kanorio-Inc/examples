// app/blog/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { image, seoMetadata } from "@kanorio/sdk";
import { toNextMetadata } from "@kanorio/sdk/next";
import { KanorioImage } from "@/components/kanorio-image";
import { kanorio } from "@/lib/kanorio";
import type { KanorioCollectionsMap } from "@/types/kanorio";

type Params = { params: Promise<{ slug: string }> };

function loadPost(slug: string) {
  return kanorio<KanorioCollectionsMap["blog"]["single"]>(
    `/collections/blog/items/${encodeURIComponent(slug)}?expand=authors,categories&formats=html`
  );
}

export async function generateStaticParams() {
  const page = await kanorio<KanorioCollectionsMap["blog"]["list"]>("/collections/blog/items?sort=-publishedAt&limit=100&fields=title");
  return (page?.data ?? []).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await loadPost((await params).slug);
  if (!data) return {};
  // Title, description, canonical, robots and the share image, by the rules the hosted site uses.
  // The share image is `fieldData.share_image`: Kanorio has picked it and cropped it the way the author framed it
  return toNextMetadata(seoMetadata(data.item));
}

export default async function BlogPost({ params }: Params) {
  const data = await loadPost((await params).slug);
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
