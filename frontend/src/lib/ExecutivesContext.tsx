import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "./api";

export type ExecutiveGroup = "executive" | "staff" | "disciplinary";

export const executiveGroups: { id: ExecutiveGroup; label: string; singular: string }[] = [
  { id: "executive", label: "Executives", singular: "Executive" },
  { id: "staff", label: "Staff members", singular: "Staff member" },
  { id: "disciplinary", label: "Disciplinary committee", singular: "Disciplinary member" },
];

export interface Executive {
  id: string;
  name: string;
  title: string;
  group: ExecutiveGroup;
  photo: string;
}

interface ApiExecutive {
  id: number;
  name: string;
  title: string;
  group?: ExecutiveGroup;
  photo: string | null;
  sortOrder: number;
}

function fromApi(e: ApiExecutive): Executive {
  return { id: String(e.id), name: e.name, title: e.title, group: e.group ?? "executive", photo: e.photo ?? "" };
}

export interface ExecutiveInput {
  name: string;
  title: string;
  group: ExecutiveGroup;
  photo: string;
}

function toApiBody(input: Partial<ExecutiveInput>) {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.title !== undefined) body.title = input.title;
  if (input.group !== undefined) body.group = input.group;
  if (input.photo !== undefined) body.photo_url = input.photo || null;
  return body;
}

interface ExecutivesContextValue {
  executives: Executive[];
  loading: boolean;
  addExecutive: (input: ExecutiveInput) => Promise<void>;
  updateExecutive: (id: string, patch: Partial<ExecutiveInput>) => Promise<void>;
  removeExecutive: (id: string) => Promise<void>;
  reorderExecutives: (ids: string[]) => Promise<void>;
}

const ExecutivesContext = createContext<ExecutivesContextValue | null>(null);

function message(err: unknown, fallback: string) {
  return new Error(err instanceof ApiError ? err.message : fallback);
}

export function ExecutivesProvider({ children }: { children: ReactNode }) {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: ApiExecutive[] }>("/executives")
      .then((res) => setExecutives(res.data.map(fromApi)))
      .catch(() => {
        // API unreachable — the page shows its empty state.
      })
      .finally(() => setLoading(false));
  }, []);

  async function addExecutive(input: ExecutiveInput) {
    try {
      const res = await apiFetch<{ data: ApiExecutive }>("/executives", {
        method: "POST",
        body: JSON.stringify(toApiBody(input)),
      });
      setExecutives((prev) => [...prev, fromApi(res.data)]);
    } catch (err) {
      throw message(err, "Couldn't add that executive.");
    }
  }

  async function updateExecutive(id: string, patch: Partial<ExecutiveInput>) {
    try {
      const res = await apiFetch<{ data: ApiExecutive }>(`/executives/${id}`, {
        method: "PUT",
        body: JSON.stringify(toApiBody(patch)),
      });
      setExecutives((prev) => prev.map((e) => (e.id === id ? fromApi(res.data) : e)));
    } catch (err) {
      throw message(err, "Couldn't save that executive.");
    }
  }

  async function removeExecutive(id: string) {
    try {
      await apiFetch(`/executives/${id}`, { method: "DELETE" });
      setExecutives((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      throw message(err, "Couldn't remove that executive.");
    }
  }

  async function reorderExecutives(ids: string[]) {
    const previous = executives;
    // Move straight away; roll back if the server refuses.
    setExecutives(ids.map((id) => previous.find((e) => e.id === id)!).filter(Boolean));
    try {
      const res = await apiFetch<{ data: ApiExecutive[] }>("/executives/order", {
        method: "PUT",
        body: JSON.stringify({ ids: ids.map(Number) }),
      });
      setExecutives(res.data.map(fromApi));
    } catch (err) {
      setExecutives(previous);
      throw message(err, "Couldn't save the new order.");
    }
  }

  return (
    <ExecutivesContext.Provider
      value={{ executives, loading, addExecutive, updateExecutive, removeExecutive, reorderExecutives }}
    >
      {children}
    </ExecutivesContext.Provider>
  );
}

export function useExecutives() {
  const ctx = useContext(ExecutivesContext);
  if (!ctx) throw new Error("useExecutives must be used within an ExecutivesProvider");
  return ctx;
}
