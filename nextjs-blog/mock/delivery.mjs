// A stand-in for one site's Content Delivery API, for running this example without a Kanorio site
// and for the automated check that the guide's code works. Responses have the same shape and the same
// X-Kanorio-Cache-Tags as the real API. Usage: node mock/delivery.mjs [port]  (default 4010)
//
// Control endpoints (not part of the real API):
//   POST /__mock/posts/<slug>?title=…   change a post's title
//   POST /__mock/posts/<slug>/publish   publish a post that is not published yet
//   GET  /__mock/hits                   how many times each API path was read
import { readFileSync, realpathSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";

const SITE_ID = "ws_example123";
const collections = JSON.parse(readFileSync(new URL("./collections.json", import.meta.url), "utf8"));

// Image URLs have the shape the real API gives: the last path segment is the size (`assets` gives the original size),
// and replacing it with another size (`w=800,fit=scale-down`) asks the edge for that size
const ORIGINAL_SIZE = "w=12000,h=12000,fit=scale-down,q=85";
const imageUrl = (assetId, variant = ORIGINAL_SIZE) => `https://img.kanorio.com/cdn-cgi/imagedelivery/example/${assetId}/${variant}`;

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
  credit: null,
  sourceUrl: null,
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
  [
    "logo-post",
    {
      id: "item_logo",
      slug: "logo-post",
      publishedAt: "2026-10-29T02:00:00.000Z",
      title: "Logo post",
      excerpt: null,
      // the cover is an SVG: Kanorio does not resize it and has no pixel size for it
      cover_image: "asset_logo",
      seo: { ogImage: "asset_share" },
    },
  ],
  [
    "fourth-post",
    {
      id: "item_fourth",
      slug: "fourth-post",
      // not published yet: lists leave it out and reading it is a 404 until POST /__mock/posts/fourth-post/publish
      publishedAt: null,
      title: "Fourth post",
      excerpt: null,
      cover_image: null,
      seo: { autoOgImage: "https://img.example.com/auto-fourth-post.png" },
    },
  ],
]);

/** The time a post published from the control endpoint gets: fixed, so every run gives the same responses */
const PUBLISHED_ON_REQUEST = "2026-11-03T02:00:00.000Z";

// The cover has what the owner can set in the media library: alt text, a focal point, and the blurred preview Kanorio makes
const ASSETS = {
  asset_share: asset("asset_share"),
  asset_cover: {
    ...asset("asset_cover"),
    alt: "A desk with a laptop",
    focus: { x: 0.2, y: 0.4 },
    placeholder: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  },
  // An SVG is served as the file it is, from the media host: no size parameters, and no width or height
  asset_logo: { ...asset("asset_logo"), url: "https://media.kanorio.com/example/logo.svg", width: null, height: null, mimeType: "image/svg+xml" },
};

// Like the real API, `share_image` is resolved on the server: the share image the author chose (cropped to 1200x630),
// else the cover, else the title card Kanorio generated. `source` says which one it is
function shareImage(post) {
  const chosen = post.seo.ogImage ?? post.cover_image;
  if (chosen) {
    const source = post.seo.ogImage ? "chosen" : "cover";
    return { url: imageUrl(chosen, "w=1200,h=630,fit=crop,q=85"), alt: ASSETS[chosen].alt, source, width: 1200, height: 630 };
  }
  return post.seo.autoOgImage ? { url: post.seo.autoOgImage, alt: null, source: "title_card", width: 1200, height: 630 } : null;
}

function toItem(post, { full }) {
  return {
    id: post.id,
    slug: post.slug,
    path: `/blog/${post.slug}`,
    publishedAt: post.publishedAt,
    updatedAt: post.publishedAt,
    // alt text written where the item uses an image, by field and asset id; these posts use each image's own alt text
    imageAlt: {},
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
const reply = (status, body, tags = null) => ({ status, body, tags });
const notFound = (code, tags = null) => reply(404, { error: { code, message: "Not found." } }, tags);

/**
 * One request, answered like the real API: the status, the JSON body and the X-Kanorio-Cache-Tags (null for none).
 * Exported so a test can call it without starting a server.
 */
export function answer(method, requestUrl) {
  const url = new URL(requestUrl, "http://mock");
  const path = url.pathname;

  if (path === "/__mock/hits") return reply(200, hits);
  const control = path.match(/^\/__mock\/posts\/([^/]+)(\/publish)?$/);
  if (control && method === "POST") {
    const post = posts.get(control[1]);
    if (!post) return notFound("ITEM_NOT_FOUND");
    if (control[2]) post.publishedAt ??= PUBLISHED_ON_REQUEST;
    else post.title = url.searchParams.get("title") ?? post.title;
    return reply(200, { ok: true });
  }

  if (!path.startsWith("/api/v1/")) return notFound("NOT_FOUND");
  hits[path] = (hits[path] ?? 0) + 1;
  const api = path.slice("/api/v1".length);

  if (api === "/collections") return reply(200, { data: collections, hasMore: false, nextCursor: null }, [`site:${SITE_ID}`, "collections"]);
  if (api === "/collections/blog/items") {
    const data = [...posts.values()]
      .filter((post) => post.publishedAt)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((post) => toItem(post, { full: false }));
    return reply(200, { data, hasMore: false, nextCursor: null, assets: ASSETS }, [`site:${SITE_ID}`, "collection:blog"]);
  }
  const single = api.match(/^\/collections\/blog\/items\/([^/]+)$/);
  if (single) {
    const post = posts.get(decodeURIComponent(single[1]));
    // A 404 cannot name the item, so like the real API it carries the collection's tags. The event sent when the item is
    // published carries `collection:blog`, which refreshes a "not found" a front end cached for it
    if (!post?.publishedAt) return notFound("ITEM_NOT_FOUND", [`site:${SITE_ID}`, "collection:blog", "collection:blog:items"]);
    // a single item carries its own id; it does not carry the list tag
    return reply(200, { item: toItem(post, { full: true }), assets: ASSETS }, [`site:${SITE_ID}`, "collection:blog:items", `item:${post.id}`]);
  }
  return notFound("NOT_FOUND");
}

const server = http.createServer((req, res) => {
  const { status, body, tags } = answer(req.method, req.url);
  res.writeHead(status, {
    "content-type": "application/json",
    ...(tags ? { "x-kanorio-cache-tags": tags.join(" ") } : {}),
  });
  res.end(JSON.stringify(body));
});

// Listen only when run as a script (`node mock/delivery.mjs`), not when a test imports `answer`
function runAsScript() {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (runAsScript()) {
  const port = Number(process.argv[2] ?? 4010);
  server.listen(port, "127.0.0.1", () => console.log(`mock Delivery API on http://127.0.0.1:${server.address().port}`));
}
