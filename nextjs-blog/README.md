# Kanorio blog on Next.js

A Next.js App Router blog that reads from Kanorio's Content Delivery API: cached reads, webhook revalidation, draft mode, SEO files, edge redirects.

Every file under `app/`, `lib/`, `next.config.ts` and `proxy.ts` is the code from the [Next.js guide](https://kanorio.com/en/developers/guides/nextjs), unchanged. `variants/cache-components/` holds the files that differ when you follow [Next.js with Cache Components](https://kanorio.com/en/developers/guides/nextjs-cache-components): copy them over the main ones.

## Run it against your site

```bash
npm install
cp .env.example .env.local   # fill in the site URL and secrets from the site's Frontend page
npm run types                # writes types/kanorio.d.ts from your site's collections
npm run dev
```

Route folders follow the paths Kanorio uses for the content (`path` on every item). The blog lives under `/blog` unless the site owner changed its base path.

## Run it without a site

`mock/delivery.mjs` answers like one site's Content Delivery API, with three published posts and a fourth that is published while the check runs.

```bash
npm run mock                                         # http://127.0.0.1:4010
NEXT_PUBLIC_KANORIO_SITE_URL=http://127.0.0.1:4010 KANORIO_WEBHOOK_SECRET=whsec_example npm run dev
```

`node mock/scenario.mjs` builds the app, serves it against the mock and checks that reads are cached, that a signed webhook refreshes an edited post and brings in a post that was visited before it was published, and that titles, canonical URLs and share images come out right. Kanorio runs the same check against every SDK release.
