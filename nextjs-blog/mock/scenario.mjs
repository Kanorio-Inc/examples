// Builds this app, serves it against the mock Delivery API and checks what the guide promises:
// reads are cached, a signed webhook refreshes the changed post, metadata comes from the post's SEO fields.
// Usage (from the app folder, after npm install): node mock/scenario.mjs [--per-record]
//   --per-record  also require that editing one post does not read the other post again
//                 (true when cache tags come from the response, as in the Cache Components variant)
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWebhookSignatureHeader, eventCacheTags } from "@kanorio/sdk";

const perRecord = process.argv.includes("--per-record");
const SECRET = "whsec_example";
const children = [];
const failures = [];
const check = (ok, message) => {
  console.log(`  ${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failures.push(message);
};

const freePort = () =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

function start(command, args, env, readyPattern) {
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  let output = "";
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      output += chunk;
      if (readyPattern.test(output)) resolve(child);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => reject(new Error(`${command} ${args.join(" ")} exited with ${code}\n${output.slice(-2000)}`)));
    setTimeout(() => reject(new Error(`${command} ${args.join(" ")} did not become ready\n${output.slice(-2000)}`)), 60_000);
  });
}

async function run(command, args, env) {
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`${command} ${args.join(" ")} failed (${code})\n${output.slice(-4000)}`);
  return output;
}

const mockPort = await freePort();
const appPort = await freePort();
const mock = `http://127.0.0.1:${mockPort}`;
const app = `http://127.0.0.1:${appPort}`;
const env = {
  NEXT_PUBLIC_KANORIO_SITE_URL: mock,
  KANORIO_SITE_ID: "ws_example123",
  KANORIO_WEBHOOK_SECRET: SECRET,
  NEXT_TELEMETRY_DISABLED: "1",
};

const page = async (path) => {
  const res = await fetch(`${app}${path}`);
  return { status: res.status, html: await res.text() };
};
const hits = async () => (await fetch(`${mock}/__mock/hits`)).json();
const itemHits = async (slug) => (await hits())[`/api/v1/collections/blog/items/${slug}`] ?? 0;
// streamed pages put the text between comment markers; compare on the visible text
const text = (html) => html.replace(/<!--.*?-->/g, "");

try {
  await start("node", ["mock/delivery.mjs", String(mockPort)], env, /mock Delivery API/);
  console.log("Types");
  const generated = join(mkdtempSync(join(tmpdir(), "kanorio-types-")), "kanorio.d.ts");
  await run("npx", ["kanorio", "types", "--site", mock, "--out", generated], env);
  check(readFileSync(generated, "utf8") === readFileSync("types/kanorio.d.ts", "utf8"), "kanorio types reproduces types/kanorio.d.ts from the site's collections");

  console.log("Building");
  const build = await run("npx", ["next", "build"], env);
  check(/\/blog\/\[slug\]/.test(build), "next build succeeds with the guide's files");
  await start("npx", ["next", "start", "-p", String(appPort), "-H", "127.0.0.1"], env, /Ready|started server/i);

  console.log("Reading");
  const first = await page("/blog/first-post");
  check(first.status === 200 && text(first.html).includes("<h1>First post</h1>"), "the post page renders the post");
  check(text(first.html).includes("<title>First post | Example</title>"), "the title is the post's SEO title plus the layout's template");
  check(first.html.includes('rel="canonical" href="https://www.example.com/blog/first-post"'), "the canonical URL is the post's path on the site's own domain");
  const image = (assetId, variant) => `https://img.kanorio.com/cdn-cgi/imagedelivery/example/${assetId}/${variant}`;
  check(first.html.includes(`property="og:image" content="${image("asset_share", "w=1200,h=630,fit=crop")}"`), "the share image is the one Kanorio resolved: the image the author chose, cropped");
  const articleImg = first.html.match(/<article[\s\S]*?(<img[^>]*>)/)?.[1] ?? "";
  check(articleImg.includes(`src="${image("asset_cover", "w=1200,fit=scale-down")}"`) && articleImg.includes('alt="A desk with a laptop"'), "the article page draws the cover the author picked, resized, with the asset's alt text");
  check(articleImg.includes(`${image("asset_cover", "w=1600,fit=scale-down")} 1600w`), "the cover offers several widths in srcset");
  const second = await page("/blog/second-post");
  check(second.html.includes('property="og:image" content="https://img.example.com/auto-second-post.png"'), "without a share image or a cover, the generated title card is used");
  check(!/<article[\s\S]*<img/.test(second.html), "a post without a cover draws no cover on the article page");
  const third = await page("/blog/third-post");
  check(third.html.includes(`property="og:image" content="${image("asset_cover", "w=1200,h=630,fit=crop")}"`), "without a chosen share image, the cover is the share image");
  check(second.html.includes('rel="canonical" href="https://www.example.com/guides/second"'), "a canonical address the author set replaces the post's path");
  check(/name="robots" content="noindex/.test(second.html), "noindex set by the author reaches the robots meta tag");
  check(!/name="robots" content="noindex/.test(first.html), "a post without it stays indexable");
  const list = await page("/blog");
  check(list.html.includes('href="/blog/first-post"') && text(list.html).includes("Second post"), "the list links each post by its path");
  check(list.html.includes(`src="${image("asset_cover", "w=800,fit=scale-down")}"`), "the list shows the cover (an asset id, resolved from the assets map) at card size");
  check(!list.html.includes("asset_share"), "a post with a cover does not show its share image on the list");
  check(list.html.includes('src="https://img.example.com/auto-second-post.png"'), "a post without a cover falls back to its share image (here the title card)");
  check((await page("/blog/missing")).status === 404, "an unknown slug is a 404");

  await page("/blog/first-post");
  check((await itemHits("first-post")) === 1, "a second visit is served from the cache (one read of the post)");

  console.log("Editing a post");
  await fetch(`${mock}/__mock/posts/first-post?title=${encodeURIComponent("First post, edited")}`, { method: "POST" });
  check(text((await page("/blog/first-post")).html).includes("<h1>First post</h1>"), "before the webhook, the cached page is still served");

  const body = JSON.stringify({
    version: "1",
    id: "delivery_example",
    event: "collections.item.published",
    data: { cacheTags: eventCacheTags.itemChanged({ collectionKey: "blog", itemId: "item_first" }) },
  });
  const signed = { "content-type": "application/json", "x-kanorio-signature": await buildWebhookSignatureHeader(SECRET, body, Math.floor(Date.now() / 1000)) };
  const webhook = await fetch(`${app}/api/revalidate`, { method: "POST", headers: signed, body });
  check(webhook.status === 200, "the revalidate route accepts a signed event");
  const unsigned = await fetch(`${app}/api/revalidate`, { method: "POST", headers: { "content-type": "application/json", "x-kanorio-signature": "t=1,v1=00" }, body });
  check(unsigned.status === 401, "the revalidate route rejects a bad signature");

  // "max" serves the cached page once more while the fresh one is prepared
  let refreshed = false;
  for (let attempt = 0; attempt < 10 && !refreshed; attempt++) {
    refreshed = text((await page("/blog/first-post")).html).includes("<h1>First post, edited</h1>");
    if (!refreshed) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  check(refreshed, "after the webhook, the post page shows the edit");
  let listRefreshed = false;
  for (let attempt = 0; attempt < 10 && !listRefreshed; attempt++) {
    listRefreshed = text((await page("/blog")).html).includes("First post, edited");
    if (!listRefreshed) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  check(listRefreshed, "after the webhook, the list shows the edit");

  await page("/blog/second-post");
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page("/blog/second-post");
  const secondReads = await itemHits("second-post");
  if (perRecord) check(secondReads === 1, "the other post was not read again (tags came from the response)");
  else console.log(`  – the other post was read ${secondReads} time(s): single items share the collection tag in this setup`);
} catch (error) {
  failures.push(String(error?.message ?? error));
  console.error(error);
} finally {
  for (const child of children) child.kill();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
process.exit(0);
