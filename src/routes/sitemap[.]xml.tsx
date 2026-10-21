import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://shyfft.lovable.app";

const PUBLIC_PATHS = ["", "/auth", "/reset-password"];

function sitemapXml() {
  const urls = PUBLIC_PATHS.map(
    (path) =>
      `  <url>\n    <loc>${SITE}${path}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export const Route = createFileRoute("/sitemap[.]xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(sitemapXml(), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
