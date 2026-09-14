import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://hyakunin-isshu-silk.vercel.app/sitemap.xml",
  };
}
