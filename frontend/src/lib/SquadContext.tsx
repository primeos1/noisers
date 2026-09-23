import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { seedSquad, type Player, type Position } from "./clubData";
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
}

function fromApi(p: ApiPlayer): Player {
  return {
    number: p.number,
    name: p.name,
    position: p.position,
    photo: p.photoUrl || `https://i.pravatar.cc/400?img=${(p.number % 70) + 1}`,
    rating: p.rating,
    appearances: p.appearances,
    goals: p.goals,
    assists: p.assists,
    cleanSheets: p.cleanSheets,
  };
}

function toApiBody(player: Partial<Player>) {
  const body: Record<string, unknown> = {};
  if (player.number !== undefined) body.number = player.number;
  if (player.name !== undefined) body.name = player.name;
  if (player.position !== undefined) body.position = player.position;
  if (player.rating !== undefined) body.rating = player.rating;
  if (player.photo !== undefined) body.photo_url = player.photo || null;
  return body;
}

interface SquadContextValue {
  players: Player[];
  loading: boolean;
  error: string;
  addPlayer: (player: Player) => void;
  updatePlayer: (number: number, patch: Partial<Player>) => void;
  removePlayer: (number: number) => void;
}

const SquadContext = createContext<SquadContextValue | null>(null);

export function SquadProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>(seedSquad);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const playersRef = useRef(players);
  playersRef.current = players;

  useEffect(() => {
    apiFetch<{ data: ApiPlayer[] }>("/players?active_only=false")
      .then((res) => setPlayers(res.data.map(fromApi)))
      .catch(() => {
        // API unreachable — keep the seed squad, app still works.
      })
      .finally(() => setLoading(false));
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
    setPlayers((prev) => prev.map((p) => (p.number === number ? { ...p, ...patch } : p)));
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
    <SquadContext.Provider value={{ players, loading, error, addPlayer, updatePlayer, removePlayer }}>
      {children}
    </SquadContext.Provider>
  );
}

export function useSquad() {
  const ctx = useContext(SquadContext);
  if (!ctx) throw new Error("useSquad must be used within a SquadProvider");
  return ctx;
}
