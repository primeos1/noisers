import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isStockPhoto, seedSquad, stockPhoto, type Player, type Position } from "./clubData";
import { apiFetch, ApiError } from "./api";

interface ApiPlayer {
  id: number;
  number: number;
  name: string;
  position: Position;
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
}

function fromApi(p: ApiPlayer): Player {
  return {
    number: p.number,
    name: p.name,
    position: p.position,
    photo: p.photoUrl && !isStockPhoto(p.photoUrl) ? p.photoUrl : stockPhoto(p.number),
    rating: p.rating,
    appearances: p.appearances,
    goals: p.goals,
    assists: p.assists,
    cleanSheets: p.cleanSheets,
    yellowCards: p.yellowCards ?? 0,
    redCards: p.redCards ?? 0,
  };
}

function toApiBody(player: Partial<Player>) {
  const body: Record<string, unknown> = {};
  if (player.number !== undefined) body.number = player.number;
  if (player.name !== undefined) body.name = player.name;
  if (player.position !== undefined) body.position = player.position;
  if (player.rating !== undefined) body.rating = player.rating;
  if (player.photo !== undefined) body.photo_url = player.photo && !isStockPhoto(player.photo) ? player.photo : null;
  return body;
}

interface SquadContextValue {
  players: Player[];
  loading: boolean;
  error: string;
  addPlayer: (player: Player) => void;
  updatePlayer: (number: number, patch: Partial<Player>) => void;
  removePlayer: (number: number) => void;
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

  function addPlayer(player: Player) {
    setError("");
    apiFetch<{ data: ApiPlayer }>("/players", {
      method: "POST",
      body: JSON.stringify(toApiBody(player)),
    })
      .then((res) => setPlayers((prev) => [...prev, fromApi(res.data)]))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't add that player."));
  }

  function updatePlayer(number: number, patch: Partial<Player>) {
    setError("");
    const previous = playersRef.current;
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.number !== number) return p;
        const next = { ...p, ...patch };
        return next.photo ? next : { ...next, photo: stockPhoto(next.number) };
      }),
    );
    apiFetch<{ data: ApiPlayer }>(`/players/${number}`, {
      method: "PUT",
      body: JSON.stringify(toApiBody(patch)),
    })
      .then((res) => {
        const updated = fromApi(res.data);
        setPlayers((prev) => prev.map((p) => (p.number === number ? updated : p)));
      })
      .catch((err) => {
        setPlayers(previous);
        setError(err instanceof ApiError ? err.message : "Couldn't save that player.");
      });
  }

  function removePlayer(number: number) {
    setError("");
    const previous = playersRef.current;
    setPlayers((prev) => prev.filter((p) => p.number !== number));
    apiFetch(`/players/${number}`, { method: "DELETE" }).catch((err) => {
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
