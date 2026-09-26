import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isStockPhoto, seedSquad, stockPhoto, type Membership, type Player, type Position, type RatingPoint } from "./clubData";
import { apiFetch, ApiError } from "./api";

interface ApiPlayer {
  id: number;
  number: number;
  name: string;
  position: Position;
  secondaryPosition?: Position | null;
  membership?: Membership;
  bio: string | null;
  photoUrl: string | null;
  active: boolean;
  rating: number;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards?: number;
  redCards?: number;
  ratingHistory?: RatingPoint[];
}

function fromApi(p: ApiPlayer): Player {
  return {
    id: p.id,
    number: p.number,
    name: p.name,
    position: p.position,
    secondaryPosition: p.secondaryPosition ?? null,
    membership: p.membership ?? "member",
    photo: p.photoUrl && !isStockPhoto(p.photoUrl) ? p.photoUrl : stockPhoto(p.id),
    rating: p.rating,
    appearances: p.appearances,
    goals: p.goals,
    assists: p.assists,
    cleanSheets: p.cleanSheets,
    yellowCards: p.yellowCards ?? 0,
    redCards: p.redCards ?? 0,
    ratingHistory: p.ratingHistory ?? [],
  };
}

function toApiBody(player: Partial<Player>) {
  const body: Record<string, unknown> = {};
  if (player.number !== undefined) body.number = player.number;
  if (player.name !== undefined) body.name = player.name;
  if (player.position !== undefined) body.position = player.position;
  if (player.membership !== undefined) body.membership = player.membership;
  if (player.secondaryPosition !== undefined) body.secondary_position = player.secondaryPosition || null;
  if (player.rating !== undefined) body.rating = player.rating;
  if (player.photo !== undefined) body.photo_url = player.photo && !isStockPhoto(player.photo) ? player.photo : null;
  return body;
}

interface SquadContextValue {
  players: Player[];
  loading: boolean;
  error: string;
  addPlayer: (player: Omit<Player, "id">) => Promise<Player | null>;
  updatePlayer: (id: number, patch: Partial<Player>) => void;
  removePlayer: (id: number) => void;
  refresh: () => Promise<void>;
}

const SquadContext = createContext<SquadContextValue | null>(null);

export function SquadProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>(seedSquad);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const playersRef = useRef(players);
  playersRef.current = players;

  // Stats are computed server-side from finished Match Day games, so this
  // is re-run whenever a game or match day ends (see pages/admin/MatchDay).
  function refresh() {
    return apiFetch<{ data: ApiPlayer[] }>("/players?active_only=false")
      .then((res) => setPlayers(res.data.map(fromApi)))
      .catch(() => {
        // API unreachable — keep the current squad, app still works.
      });
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  /** Resolves with the saved player (null on failure) — its id comes from the server. */
  function addPlayer(player: Omit<Player, "id">): Promise<Player | null> {
    setError("");
    return apiFetch<{ data: ApiPlayer }>("/players", {
      method: "POST",
      body: JSON.stringify(toApiBody(player)),
    })
      .then((res) => {
        const created = fromApi(res.data);
        setPlayers((prev) => [...prev, created]);
        return created;
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't add that player.");
        return null;
      });
  }

  function updatePlayer(id: number, patch: Partial<Player>) {
    setError("");
    const previous = playersRef.current;
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch, id };
        return next.photo ? next : { ...next, photo: stockPhoto(id) };
      }),
    );
    apiFetch<{ data: ApiPlayer }>(`/players/${id}`, {
      method: "PUT",
      body: JSON.stringify(toApiBody(patch)),
    })
      .then((res) => {
        const updated = fromApi(res.data);
        setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)));
      })
      .catch((err) => {
        setPlayers(previous);
        setError(err instanceof ApiError ? err.message : "Couldn't save that player.");
      });
  }

  function removePlayer(id: number) {
    setError("");
    const previous = playersRef.current;
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    apiFetch(`/players/${id}`, { method: "DELETE" }).catch((err) => {
      setPlayers(previous);
      setError(err instanceof ApiError ? err.message : "Couldn't remove that player.");
    });
  }

  return (
    <SquadContext.Provider value={{ players, loading, error, addPlayer, updatePlayer, removePlayer, refresh }}>
      {children}
    </SquadContext.Provider>
  );
}

export function useSquad() {
  const ctx = useContext(SquadContext);
  if (!ctx) throw new Error("useSquad must be used within a SquadProvider");
  return ctx;
}
