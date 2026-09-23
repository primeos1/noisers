import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "./api";

export interface HomeStat {
  id: number;
  value: string;
  label: string;
  sortOrder: number;
}

export interface GalleryImageItem {
  id: number;
  imageUrl: string;
  alt: string | null;
  caption: string | null;
  sortOrder: number;
}

export interface HomeContentData {
  hero: { eyebrow: string; headline: string; subtext: string; imageUrl: string };
  story: { eyebrow: string; headline: string; paragraph1: string; paragraph2: string; imageUrl: string };
  atmosphere: { caption: string; imageUrl: string };
  matchday: { eyebrow: string; headline: string; body: string };
  stats: HomeStat[];
  gallery: GalleryImageItem[];
}

// Shown while the real content is loading, and if the API can't be reached —
// mirrors the copy that used to be hardcoded in Hero/StorySection/etc.
export const DEFAULT_HOME_CONTENT: HomeContentData = {
  hero: {
    eyebrow: "Est. 2021 · Grassroots five-a-side",
    headline: "Vale to zenith.",
    subtext:
      "Noisers FC is a small-sided club built on the same pitch we still play on. Every set, every card, every goal — logged, tracked and built into a squad that keeps climbing.",
    imageUrl: "",
  },
  story: {
    eyebrow: "Our story",
    headline: "From the vale, toward the zenith.",
    paragraph1:
      "Noisers FC started in 2021 as a handful of regulars turning up for the same Saturday set. The name on the badge changed, the pitch didn't — and neither did the plan: play hard, look after each other, and keep the standard climbing every season.",
    paragraph2:
      "\"Vale 2 Zenith\" is the club in one line — grounded where we play, ambitious about where we're going. This site is how we run that climb: squad, sets, cards and every goal, all in one place.",
    imageUrl: "",
  },
  atmosphere: { caption: "Same tunnel, every week.", imageUrl: "" },
  matchday: {
    eyebrow: "How match day works",
    headline: "No opponent. Just the squad.",
    body: "Every session, whoever's present gets split into balanced six-a-side teams — random, by rating, or by position — then it's first to two goals on a ten-minute clock. Goals, assists and cards all get logged as they happen.",
  },
  stats: [],
  gallery: [],
};

interface HomeContentContextValue {
  content: HomeContentData;
  loading: boolean;
  error: string;
  updateContent: (patch: Partial<Omit<HomeContentData, "stats" | "gallery">>) => Promise<void>;
  addStat: (stat: { value: string; label: string }) => Promise<void>;
  updateStat: (id: number, patch: Partial<{ value: string; label: string }>) => Promise<void>;
  removeStat: (id: number) => Promise<void>;
  addGalleryImage: (image: { imageUrl: string; alt?: string; caption?: string }) => Promise<void>;
  updateGalleryImage: (id: number, patch: Partial<{ imageUrl: string; alt: string; caption: string }>) => Promise<void>;
  removeGalleryImage: (id: number) => Promise<void>;
}

const HomeContentContext = createContext<HomeContentContextValue | null>(null);

function flattenPatch(patch: Partial<Omit<HomeContentData, "stats" | "gallery">>) {
  const body: Record<string, unknown> = {};
  if (patch.hero) {
    if (patch.hero.eyebrow !== undefined) body.hero_eyebrow = patch.hero.eyebrow;
    if (patch.hero.headline !== undefined) body.hero_headline = patch.hero.headline;
    if (patch.hero.subtext !== undefined) body.hero_subtext = patch.hero.subtext;
    if (patch.hero.imageUrl !== undefined) body.hero_image_url = patch.hero.imageUrl;
  }
  if (patch.story) {
    if (patch.story.eyebrow !== undefined) body.story_eyebrow = patch.story.eyebrow;
    if (patch.story.headline !== undefined) body.story_headline = patch.story.headline;
    if (patch.story.paragraph1 !== undefined) body.story_paragraph_1 = patch.story.paragraph1;
    if (patch.story.paragraph2 !== undefined) body.story_paragraph_2 = patch.story.paragraph2;
    if (patch.story.imageUrl !== undefined) body.story_image_url = patch.story.imageUrl;
  }
  if (patch.atmosphere) {
    if (patch.atmosphere.caption !== undefined) body.atmosphere_caption = patch.atmosphere.caption;
    if (patch.atmosphere.imageUrl !== undefined) body.atmosphere_image_url = patch.atmosphere.imageUrl;
  }
  if (patch.matchday) {
    if (patch.matchday.eyebrow !== undefined) body.matchday_eyebrow = patch.matchday.eyebrow;
    if (patch.matchday.headline !== undefined) body.matchday_headline = patch.matchday.headline;
    if (patch.matchday.body !== undefined) body.matchday_body = patch.matchday.body;
  }
  return body;
}

export function HomeContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<HomeContentData>(DEFAULT_HOME_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ data: HomeContentData }>("/home-content")
      .then((res) => setContent(res.data))
      .catch(() => {
        // API unreachable — keep the defaults, app still works.
      })
      .finally(() => setLoading(false));
  }, []);

  async function updateContent(patch: Partial<Omit<HomeContentData, "stats" | "gallery">>) {
    setError("");
    try {
      const res = await apiFetch<{ data: HomeContentData }>("/home-content", {
        method: "PUT",
        body: JSON.stringify(flattenPatch(patch)),
      });
      setContent((prev) => ({ ...prev, ...res.data, stats: prev.stats, gallery: prev.gallery }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that change.");
      throw err;
    }
  }

  async function addStat(stat: { value: string; label: string }) {
    setError("");
    try {
      const res = await apiFetch<{ data: HomeStat }>("/home-stats", {
        method: "POST",
        body: JSON.stringify(stat),
      });
      setContent((prev) => ({ ...prev, stats: [...prev.stats, res.data] }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that stat.");
      throw err;
    }
  }

  async function updateStat(id: number, patch: Partial<{ value: string; label: string }>) {
    setError("");
    try {
      const res = await apiFetch<{ data: HomeStat }>(`/home-stats/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setContent((prev) => ({ ...prev, stats: prev.stats.map((s) => (s.id === id ? res.data : s)) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that stat.");
      throw err;
    }
  }

  async function removeStat(id: number) {
    setError("");
    try {
      await apiFetch(`/home-stats/${id}`, { method: "DELETE" });
      setContent((prev) => ({ ...prev, stats: prev.stats.filter((s) => s.id !== id) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that stat.");
      throw err;
    }
  }

  async function addGalleryImage(image: { imageUrl: string; alt?: string; caption?: string }) {
    setError("");
    try {
      const res = await apiFetch<{ data: GalleryImageItem }>("/gallery-images", {
        method: "POST",
        body: JSON.stringify({ image_url: image.imageUrl, alt: image.alt, caption: image.caption }),
      });
      setContent((prev) => ({ ...prev, gallery: [...prev.gallery, res.data] }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that image.");
      throw err;
    }
  }

  async function updateGalleryImage(
    id: number,
    patch: Partial<{ imageUrl: string; alt: string; caption: string }>,
  ) {
    setError("");
    try {
      const res = await apiFetch<{ data: GalleryImageItem }>(`/gallery-images/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(patch.imageUrl !== undefined && { image_url: patch.imageUrl }),
          ...(patch.alt !== undefined && { alt: patch.alt }),
          ...(patch.caption !== undefined && { caption: patch.caption }),
        }),
      });
      setContent((prev) => ({ ...prev, gallery: prev.gallery.map((g) => (g.id === id ? res.data : g)) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that image.");
      throw err;
    }
  }

  async function removeGalleryImage(id: number) {
    setError("");
    try {
      await apiFetch(`/gallery-images/${id}`, { method: "DELETE" });
      setContent((prev) => ({ ...prev, gallery: prev.gallery.filter((g) => g.id !== id) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that image.");
      throw err;
    }
  }

  return (
    <HomeContentContext.Provider
      value={{
        content,
        loading,
        error,
        updateContent,
        addStat,
        updateStat,
        removeStat,
        addGalleryImage,
        updateGalleryImage,
        removeGalleryImage,
      }}
    >
      {children}
    </HomeContentContext.Provider>
  );
}

export function useHomeContent() {
  const ctx = useContext(HomeContentContext);
  if (!ctx) throw new Error("useHomeContent must be used within a HomeContentProvider");
  return ctx;
}
