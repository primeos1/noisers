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

// The league has its own subdomain, served from league.html by this same
// service; the old /league page on the main site sends people there.
const isLeagueHost = (host) => /^league\./i.test(host ?? "");

function leagueRedirect(req) {
  const host = (req.headers.host ?? "").replace(/^www\./i, "");
  const pathname = (req.url ?? "/").split("?")[0].replace(/\/+$/, "");
  if (isLeagueHost(host) || !/^\/league(\/.*)?$/i.test(pathname)) return null;
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  return local ? `http://league.${host.replace("127.0.0.1", "localhost")}/` : `https://league.${host.split(":")[0]}/`;
}

http
  .createServer((req, res) => {
    const to = leagueRedirect(req);
    if (to) {
      res.writeHead(301, { Location: to });
      return res.end();
    }
    if (isLeagueHost(req.headers.host)) {
      // Every page on the subdomain is the league page; real files (assets,
      // favicon) are served as they are.
      const [pathname, query] = (req.url ?? "/").split("?");
      if (!path.extname(pathname)) req.url = `/league.html${query ? `?${query}` : ""}`;
      return handler(req, res, { public: dist, headers });
    }
    return handler(req, res, {
      public: dist,
      cleanUrls: true,
      headers,
      rewrites: hasPage(req.url) ? [] : [{ source: "**", destination: "/index.html" }],
    });
  })
  .listen(port, () => console.log(`Serving dist on port ${port}`));
