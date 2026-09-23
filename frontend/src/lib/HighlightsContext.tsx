import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "./api";
import type { HighlightCategory, HighlightItem, MediaType } from "./highlights";

interface ApiHighlight {
  id: number;
  type: MediaType;
  src: string;
  alt: string | null;
  caption: string | null;
  category: HighlightCategory;
  date: string | null;
  tall: boolean;
  sortOrder: number;
}

function fromApi(h: ApiHighlight): HighlightItem {
  return {
    id: String(h.id),
    type: h.type,
    src: h.src,
    alt: h.alt ?? "",
    caption: h.caption ?? "",
    category: h.category,
    date: h.date ?? "",
    tall: h.tall,
  };
}

export interface NewHighlightInput {
  type: MediaType;
  mediaUrl: string;
  alt?: string;
  caption?: string;
  category: HighlightCategory;
  occurredOn?: string;
  tall?: boolean;
}

function toApiBody(input: Partial<NewHighlightInput>) {
  const body: Record<string, unknown> = {};
  if (input.type !== undefined) body.type = input.type;
  if (input.mediaUrl !== undefined) body.media_url = input.mediaUrl;
  if (input.alt !== undefined) body.alt = input.alt;
  if (input.caption !== undefined) body.caption = input.caption;
  if (input.category !== undefined) body.category = input.category;
  if (input.occurredOn !== undefined) body.occurred_on = input.occurredOn || null;
  if (input.tall !== undefined) body.tall = input.tall;
  return body;
}

interface HighlightsContextValue {
  highlights: HighlightItem[];
  loading: boolean;
  error: string;
  addHighlight: (input: NewHighlightInput) => Promise<void>;
  updateHighlight: (id: string, patch: Partial<NewHighlightInput>) => Promise<void>;
  removeHighlight: (id: string) => Promise<void>;
}

const HighlightsContext = createContext<HighlightsContextValue | null>(null);

export function HighlightsProvider({ children }: { children: ReactNode }) {
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ data: ApiHighlight[] }>("/highlights")
      .then((res) => setHighlights(res.data.map(fromApi)))
      .catch(() => {
        // API unreachable — app still works with an empty gallery.
      })
      .finally(() => setLoading(false));
  }, []);

  async function addHighlight(input: NewHighlightInput) {
    setError("");
    try {
      const res = await apiFetch<{ data: ApiHighlight }>("/highlights", {
        method: "POST",
        body: JSON.stringify(toApiBody(input)),
      });
      setHighlights((prev) => [...prev, fromApi(res.data)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that highlight.");
      throw err;
    }
  }

  async function updateHighlight(id: string, patch: Partial<NewHighlightInput>) {
    setError("");
    try {
      const res = await apiFetch<{ data: ApiHighlight }>(`/highlights/${id}`, {
        method: "PUT",
        body: JSON.stringify(toApiBody(patch)),
      });
      setHighlights((prev) => prev.map((h) => (h.id === id ? fromApi(res.data) : h)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that highlight.");
      throw err;
    }
  }

  async function removeHighlight(id: string) {
    setError("");
    try {
      await apiFetch(`/highlights/${id}`, { method: "DELETE" });
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that highlight.");
      throw err;
    }
  }

  return (
    <HighlightsContext.Provider
      value={{ highlights, loading, error, addHighlight, updateHighlight, removeHighlight }}
    >
      {children}
    </HighlightsContext.Provider>
  );
}

export function useHighlights() {
  const ctx = useContext(HighlightsContext);
  if (!ctx) throw new Error("useHighlights must be used within a HighlightsProvider");
  return ctx;
}
