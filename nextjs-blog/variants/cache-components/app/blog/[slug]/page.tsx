// app/blog/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { kanorio } from "@/lib/kanorio";
import type { DeliveryAssetMap, KanorioCollectionsMap } from "@/types/kanorio";

type Params = { params: Promise<{ slug: string }> };

function loadPost(slug: string) {
  return kanorio<KanorioCollectionsMap["blog"]["single"]>(
    `/collections/blog/items/${encodeURIComponent(slug)}?expand=authors,categories&formats=html`
  );
}

// An image value is an asset id (look it up in `assets`) or a full URL
function imageUrl(value: string | null | undefined, assets: DeliveryAssetMap) {
  if (!value) return undefined;
  return /^https?:\/\//.test(value) ? value : assets[value]?.url;
}

export async function generateStaticParams() {
  const page = await kanorio<KanorioCollectionsMap["blog"]["list"]>("/collections/blog/items?sort=-publishedAt&limit=100&fields=title");
  return (page?.data ?? []).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await loadPost((await params).slug);
  if (!data) return {};
  const { seo, title, excerpt, cover_image } = data.item.fieldData;
  const image = imageUrl(seo?.ogImage, data.assets) ?? imageUrl(seo?.autoOgImage, data.assets) ?? imageUrl(cover_image, data.assets);
  return {
    title: seo?.title ?? title,
    description: seo?.description ?? excerpt ?? undefined,
    alternates: { canonical: data.item.path },
    openGraph: { images: image ? [image] : undefined },
  };
}

export default async function BlogPost({ params }: Params) {
  const data = await loadPost((await params).slug);
  if (!data) notFound();

  const { item, assets } = data;
  const cover = item.fieldData.cover_image ? assets[item.fieldData.cover_image] : undefined;
  return (
    <article>
      <h1>{item.fieldData.title}</h1>
      {cover && <img src={cover.url} alt={cover.alt ?? ""} width={cover.width ?? undefined} height={cover.height ?? undefined} />}
      {item.contentHtml && <div dangerouslySetInnerHTML={{ __html: item.contentHtml }} />}
    </article>
  );
}
