import type { MetadataRoute } from "next";

import { getSiteBaseUrl } from "@/shared/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/ru/deals/",
        "/en/deals/",
        "/ru/settings/",
        "/en/settings/",
        "/ru/moderation/",
        "/en/moderation/",
        "/ru/contracts/new",
        "/en/contracts/new",
        "/ru/contracts/*/edit",
        "/en/contracts/*/edit",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
