// Search and share metadata for every page. The build (see seoPlugin in
// vite.config.ts) bakes it into a static HTML file per page, so crawlers
// and link previews see the right title without running the app; useSeo
// keeps the same tags current as the app navigates. No imports here —
// vite.config.ts loads this file under Node.

export const SITE_URL = "https://noisersfc.com";
export const SITE_NAME = "Noisers FC";
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute share image; the club card when left out. */
  image?: string;
  /** Kept out of search results (and the sitemap). */
  noindex?: boolean;
  /** Extra structured data for the page (JSON-LD). */
  jsonLd?: object;
}

export interface SitemapPage extends PageMeta {
  path: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: number;
}

export const CLUB_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SportsTeam",
      "@id": `${SITE_URL}/#club`,
      name: SITE_NAME,
      alternateName: ["Noisers", "Noisers Football Club"],
      slogan: "Vale 2 Zenith",
      sport: "Soccer",
      foundingDate: "2021",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.png`,
      image: OG_IMAGE,
      description:
        "Noisers FC is a grassroots five-a-side football club in Lekki, Lagos, established in 2021. Squad ratings, match days, the Noisers League, awards and highlights.",
      location: {
        "@type": "Place",
        name: "Lekki, Lagos",
        address: { "@type": "PostalAddress", addressLocality: "Lekki", addressRegion: "Lagos", addressCountry: "NG" },
      },
      address: { "@type": "PostalAddress", addressLocality: "Lekki", addressRegion: "Lagos", addressCountry: "NG" },
      areaServed: ["Lekki", "Lagos", "Nigeria"],
      email: "noisersfootball@gmail.com",
      telephone: "+2347037851468",
      sameAs: ["https://www.instagram.com/noisersfc"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#club` },
    },
  ],
};

// Public pages, in sitemap order.
export const PAGES: SitemapPage[] = [
  {
    path: "/",
    title: "Noisers FC — Five-a-Side Football Club in Lekki, Lagos | Vale 2 Zenith",
    description:
      "Noisers FC is a grassroots five-a-side football club in Lekki, Lagos, established in 2021 and built on passion, teamwork and the drive to win. Squad ratings, match days, the Noisers League, awards and highlights.",
    jsonLd: CLUB_JSON_LD,
    changefreq: "daily",
    priority: 1,
  },
  {
    path: "/squad",
    title: "The Squad — Player Ratings, Goals & Assists | Noisers FC",
    description:
      "Every Noisers FC player's rating, goals, assists and clean sheets, logged set by set and position by position at our five-a-side games in Lekki, Lagos.",
    changefreq: "daily",
    priority: 0.9,
  },
  {
    path: "/league",
    title: "The Noisers League — Teams, Fixtures & Table | Noisers FC",
    description:
      "Six squads, six colours, one table. Fixtures, results, standings and league leaders from the Noisers League, five-a-side football in Lekki, Lagos.",
    changefreq: "daily",
    priority: 0.9,
  },
  {
    path: "/the-vale",
    title: "The Vale — Team & Player of the Week | Noisers FC",
    description:
      "Team and player of the week, player honours and the stat leaders at Noisers FC, refreshed the moment each match day ends.",
    changefreq: "daily",
    priority: 0.8,
  },
  {
    path: "/noisers",
    title: "Noisers — Match Reports & Club News | Noisers FC",
    description:
      "Match reports, team of the match day, discipline, injuries and comebacks: the latest stories from Noisers FC.",
    changefreq: "daily",
    priority: 0.8,
  },
  {
    path: "/awards",
    title: "The Awards Race — Season Honours | Noisers FC",
    description:
      "Every Noisers FC honour, replayed match day by match day: who's on top, how long they've held it and who's closing in.",
    changefreq: "weekly",
    priority: 0.7,
  },
  {
    path: "/highlights",
    title: "Highlights — Goals, Saves & Match Day Photos | Noisers FC",
    description:
      "Pictures and video from every Noisers FC set in Lekki, Lagos: goals, saves, skills and the moments in between.",
    changefreq: "weekly",
    priority: 0.7,
  },
  {
    path: "/performance",
    title: "Season Performance & Stats | Noisers FC",
    description:
      "Match day activity, the goals trend and the squad's leaderboards: the Noisers FC season so far.",
    changefreq: "weekly",
    priority: 0.6,
  },
  {
    path: "/executives",
    title: "The Executives — Club Leadership | Noisers FC",
    description: "Meet the executives who run Noisers FC, the five-a-side football club in Lekki, Lagos.",
    changefreq: "monthly",
    priority: 0.5,
  },
  {
    path: "/live",
    title: "Live Match | Noisers FC",
    description: "Follow Noisers FC match days live: scores, goals, assists and cards as they happen.",
    changefreq: "daily",
    priority: 0.5,
  },
];

const PRIVATE: PageMeta = {
  title: SITE_NAME,
  description: "Noisers FC members' area.",
  noindex: true,
};

const NOT_FOUND: PageMeta = {
  title: "Page not found | Noisers FC",
  description: "That page doesn't exist on the Noisers FC site.",
  noindex: true,
};

const PRIVATE_PREFIXES = ["/admin", "/portal", "/login", "/player-login", "/join"];

/** Metadata for a path, before any page-specific data (e.g. a player) is known. */
export function metaForPath(pathname: string): PageMeta {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return PRIVATE;
  const page = PAGES.find((p) => p.path === path);
  if (page) return page;
  if (/^\/noisers\/[^/]+$/.test(path)) return PAGES.find((p) => p.path === "/noisers")!;
  if (/^\/squad\/\d+$/.test(path)) {
    return { title: "Player profile | Noisers FC", description: "A Noisers FC player's ratings, goals, assists and match history." };
  }
  return NOT_FOUND;
}

export interface PlayerSeo {
  id: number;
  name: string;
  number: number;
  positionName: string;
  photoUrl?: string | null;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
}

export function playerMeta(p: PlayerSeo): PageMeta {
  const url = `${SITE_URL}/squad/${p.id}`;
  const stats = [
    `${p.appearances} appearance${p.appearances === 1 ? "" : "s"}`,
    `${p.goals} goal${p.goals === 1 ? "" : "s"}`,
    `${p.assists} assist${p.assists === 1 ? "" : "s"}`,
    ...(p.cleanSheets > 0 ? [`${p.cleanSheets} clean sheet${p.cleanSheets === 1 ? "" : "s"}`] : []),
  ];
  return {
    title: `${p.name} — #${p.number} ${p.positionName} | Noisers FC`,
    description: `${p.name} wears #${p.number} for Noisers FC, Lekki, Lagos, as a ${p.positionName.toLowerCase()}. This season: ${stats.join(", ")}. Ratings, form and match history.`,
    image: p.photoUrl || undefined,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url,
      mainEntity: {
        "@type": "Person",
        name: p.name,
        url,
        ...(p.photoUrl ? { image: p.photoUrl } : {}),
        jobTitle: p.positionName,
        memberOf: { "@type": "SportsTeam", name: SITE_NAME, url: SITE_URL },
      },
    },
  };
}

export function canonicalFor(pathname: string): string {
  const path = pathname.replace(/\/+$/, "");
  return `${SITE_URL}${path || "/"}`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The <head> tags for a page, as HTML (used by the build). */
export function renderHead(meta: PageMeta, pathname: string): string {
  const url = canonicalFor(pathname);
  const image = meta.image ?? OG_IMAGE;
  const e = escapeHtml;
  const tags = [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    `<meta name="robots" content="${meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}" />`,
    ...(meta.noindex ? [] : [`<link rel="canonical" href="${url}" />`]),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="en_GB" />`,
    `<meta property="og:title" content="${e(meta.title)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${e(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(meta.title)}" />`,
    `<meta name="twitter:description" content="${e(meta.description)}" />`,
    `<meta name="twitter:image" content="${e(image)}" />`,
    ...(meta.jsonLd
      ? [`<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c")}</script>`]
      : []),
  ];
  return tags.join("\n    ");
}
