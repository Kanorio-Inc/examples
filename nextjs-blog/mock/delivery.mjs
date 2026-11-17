// A stand-in for one site's Content Delivery API, for running this example without a Kanorio site
// and for the automated check that the guide's code works. Responses have the same shape and the same
// X-Kanorio-Cache-Tags as the real API. Usage: node mock/delivery.mjs [port]  (default 4010)
//
// Control endpoints (not part of the real API):
//   POST /__mock/posts/<slug>?title=…   change a post's title
//   GET  /__mock/hits                   how many times each API path was read
import { readFileSync } from "node:fs";
import http from "node:http";

const SITE_ID = "ws_example123";
const collections = JSON.parse(readFileSync(new URL("./collections.json", import.meta.url), "utf8"));

// Image URLs have the shape the real API gives: the last path segment is the variant (`public` is the original),
// and replacing it with a size (`w=800,fit=scale-down`) asks the edge for that size
const imageUrl = (assetId, variant = "public") => `https://img.kanorio.com/cdn-cgi/imagedelivery/example/${assetId}/${variant}`;

const asset = (assetId) => ({
  assetId,
  url: imageUrl(assetId),
  width: 1600,
  height: 900,
  alt: null,
  focus: null,
  watermarked: false,
  mimeType: "image/webp",
  fileSize: 120000,
  kind: "image",
  placeholder: null,
  edgeColor: null,
  processing: "ready",
});

const seo = (overrides) => ({
  title: null,
  description: null,
  keywords: null,
  ogImage: null,
  ogImageAlt: null,
  ogTitle: null,
  ogDescription: null,
  canonical: null,
  robotsIndex: "index",
  robotsFollow: "follow",
  twitterCard: "summary_large_image",
  autoOgImage: null,
  autoOgEnabled: true,
  autoOgKey: null,
  ...overrides,
});

const posts = new Map([
  [
    "first-post",
    {
      id: "item_first",
      slug: "first-post",
      publishedAt: "2026-11-01T02:00:00.000Z",
      title: "First post",
      excerpt: "How the blog is wired.",
      // the author picked a cover and a separate share image: both are asset ids, looked up in `assets`
      cover_image: "asset_cover",
      seo: { ogImage: "asset_share" },
    },
  ],
  [
    "second-post",
    {
      id: "item_second",
      slug: "second-post",
      publishedAt: "2026-11-02T02:00:00.000Z",
      title: "Second post",
      excerpt: null,
      // no cover and no share image chosen: Kanorio generated a title card from the title (a full URL)
      cover_image: null,
      // the author also set their own canonical address and asked search engines not to index the post
      seo: { autoOgImage: "https://img.example.com/auto-second-post.png", canonical: "https://www.example.com/guides/second", robotsIndex: "noindex" },
    },
  ],
  [
    "third-post",
    {
      id: "item_third",
      slug: "third-post",
      publishedAt: "2026-10-30T02:00:00.000Z",
      title: "Third post",
      excerpt: null,
      // a cover only: with no share image chosen, the cover is the share image too
      cover_image: "asset_cover",
      seo: {},
    },
  ],
]);

const ASSETS = { asset_share: asset("asset_share"), asset_cover: { ...asset("asset_cover"), alt: "A desk with a laptop" } };

// Like the real API, `share_image` is resolved on the server: the share image the author chose (cropped to 1200x630),
// else the cover, else the title card Kanorio generated
function shareImage(post) {
  const chosen = post.seo.ogImage ?? post.cover_image;
  if (chosen) return { url: imageUrl(chosen, "w=1200,h=630,fit=crop"), alt: ASSETS[chosen].alt };
  return post.seo.autoOgImage ? { url: post.seo.autoOgImage, alt: null } : null;
}

function toItem(post, { full }) {
  return {
    id: post.id,
    slug: post.slug,
    path: `/blog/${post.slug}`,
    publishedAt: post.publishedAt,
    updatedAt: post.publishedAt,
    fieldData: {
      title: post.title,
      excerpt: post.excerpt,
      // lists ask for these with `fields=title,excerpt,cover_image,share_image`
      cover_image: post.cover_image,
      share_image: shareImage(post),
      // like the real API, the SEO title is the post's own title unless the author wrote another one
      seo: seo({ title: post.title, description: post.excerpt, ...post.seo }),
      ...(full
        ? {
            content: `Hello from **${post.title}**.`,
            authors: [],
            categories: [],
            tags: [],
            reading_time_min: 1,
            show_toc: false,
            primary_author: null,
            primary_category: null,
          }
        : {}),
    },
    ...(full
      ? {
          expanded: { authors: [], categories: [] },
          segments: [{ type: "markdown", value: `Hello from **${post.title}**.` }],
          toc: [],
          contentHtml: `<p>Hello from <strong>${post.title}</strong>.</p>`,
        }
      : {}),
  };
}

const hits = {};
const json = (res, status, body, tags) => {
  res.writeHead(status, {
    "content-type": "application/json",
    ...(tags ? { "x-kanorio-cache-tags": tags.join(" ") } : {}),
  });
  res.end(JSON.stringify(body));
};
const notFound = (res, code) => json(res, 404, { error: { code, message: "Not found." } });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://mock");
  const path = url.pathname;

  if (path === "/__mock/hits") return json(res, 200, hits);
  const control = path.match(/^\/__mock\/posts\/([^/]+)$/);
  if (control && req.method === "POST") {
    const post = posts.get(control[1]);
    if (!post) return notFound(res, "ITEM_NOT_FOUND");
    post.title = url.searchParams.get("title") ?? post.title;
    return json(res, 200, { ok: true });
  }

  if (!path.startsWith("/api/v1/")) return notFound(res, "NOT_FOUND");
  hits[path] = (hits[path] ?? 0) + 1;
  const api = path.slice("/api/v1".length);

  if (api === "/collections") return json(res, 200, { data: collections, hasMore: false, nextCursor: null }, [`site:${SITE_ID}`, "collections"]);
  if (api === "/collections/blog/items") {
    const data = [...posts.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map((post) => toItem(post, { full: false }));
    return json(res, 200, { data, hasMore: false, nextCursor: null, assets: ASSETS }, [`site:${SITE_ID}`, "collection:blog"]);
  }
  const single = api.match(/^\/collections\/blog\/items\/([^/]+)$/);
  if (single) {
    const post = posts.get(decodeURIComponent(single[1]));
    if (!post) return notFound(res, "ITEM_NOT_FOUND");
    // a single item carries its own id; it does not carry the list tag
    return json(res, 200, { item: toItem(post, { full: true }), assets: ASSETS }, [`site:${SITE_ID}`, "collection:blog:items", `item:${post.id}`]);
  }
  return notFound(res, "NOT_FOUND");
});

const port = Number(process.argv[2] ?? 4010);
server.listen(port, "127.0.0.1", () => console.log(`mock Delivery API on http://127.0.0.1:${server.address().port}`));
