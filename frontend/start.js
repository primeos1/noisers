// Production server for dist/. Pages the build pre-rendered for search
// (squad.html, squad/27.html — see seoPlugin in vite.config.ts) are served
// at their clean URL; every other path falls back to the app's index.html.
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "serve-handler";

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const port = process.env.PORT || 3000;

const headers = [
  // Vite fingerprints everything under /assets, so it can be cached for good.
  { source: "assets/**", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
  { source: "**/*.html", headers: [{ key: "Cache-Control", value: "no-cache" }] },
];

function hasPage(url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, "http://localhost").pathname).replace(/\/+$/, "");
  } catch {
    return false;
  }
  if (!pathname || path.extname(pathname)) return false;
  const file = path.join(dist, `${pathname}.html`);
  return file.startsWith(dist + path.sep) && existsSync(file);
}

http
  .createServer((req, res) =>
    handler(req, res, {
      public: dist,
      cleanUrls: true,
      headers,
      rewrites: hasPage(req.url) ? [] : [{ source: "**", destination: "/index.html" }],
    }),
  )
  .listen(port, () => console.log(`Serving dist on port ${port}`));
