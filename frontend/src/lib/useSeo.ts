import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { OG_IMAGE, canonicalFor, type PageMeta } from "../seo";

function setTag(selector: string, create: () => HTMLElement, attr: string, value: string | null) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (value === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setMeta(key: "name" | "property", id: string, content: string) {
  setTag(
    `meta[${key}="${id}"]`,
    () => {
      const m = document.createElement("meta");
      m.setAttribute(key, id);
      return m;
    },
    "content",
    content,
  );
}

/**
 * Keeps the page's title, description, canonical link, share tags and
 * structured data in step with the screen — the same tags the build bakes
 * into each page's HTML (renderHead in seo.ts).
 */
export function useSeo(meta: PageMeta | null) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!meta) return;
    const url = canonicalFor(pathname);
    const image = meta.image ?? OG_IMAGE;
    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setMeta("name", "robots", meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    setTag(
      'link[rel="canonical"]',
      () => {
        const l = document.createElement("link");
        l.rel = "canonical";
        return l;
      },
      "href",
      meta.noindex ? null : url,
    );
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);
    setMeta("name", "twitter:image", image);
    document.head.querySelector('script[type="application/ld+json"]')?.remove();
    if (meta.jsonLd) {
      const ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.textContent = JSON.stringify(meta.jsonLd);
      document.head.appendChild(ld);
    }
  }, [meta, pathname]);
}
