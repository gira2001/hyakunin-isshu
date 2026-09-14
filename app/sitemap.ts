import type { MetadataRoute } from "next";
import { poems } from "@/data/poems";

const BASE = "https://hyakunin-isshu-silk.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: BASE, priority: 1.0 },
    { url: `${BASE}/hyakunin`, priority: 0.9 },
    { url: `${BASE}/battle`, priority: 0.8 },
    { url: `${BASE}/list`, priority: 0.8 },
    { url: `${BASE}/progress`, priority: 0.6 },
  ].map((p) => ({ ...p, lastModified: new Date(), changeFrequency: "monthly" as const }));

  const poemPages = poems.map((poem) => ({
    url: `${BASE}/poem/${poem.id}`,
    lastModified: new Date(),
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...poemPages];
}
