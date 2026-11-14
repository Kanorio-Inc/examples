// next.config.ts
import { seoRewrites } from "@kanorio/sdk";

export default {
  async rewrites() {
    return seoRewrites({ siteUrl: process.env.NEXT_PUBLIC_KANORIO_SITE_URL!, framework: "next" });
  },
};
