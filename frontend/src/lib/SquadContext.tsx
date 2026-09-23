import { createContext, useContext, type ReactNode } from "react";
import { seedSquad, type Player } from "./clubData";
import { useLocalStorageState } from "./useLocalStorageState";

interface SquadContextValue {
  players: Player[];
  addPlayer: (player: Player) => void;
  updatePlayer: (number: number, patch: Partial<Player>) => void;
  removePlayer: (number: number) => void;
}

const SquadContext = createContext<SquadContextValue | null>(null);

export function SquadProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useLocalStorageState<Player[]>("noisers_squad", seedSquad);

  function addPlayer(player: Player) {
    setPlayers((prev) => [...prev, player]);
  }

  function updatePlayer(number: number, patch: Partial<Player>) {
    setPlayers((prev) => prev.map((p) => (p.number === number ? { ...p, ...patch } : p)));
  }

  function removePlayer(number: number) {
    setPlayers((prev) => prev.filter((p) => p.number !== number));
  }

  return (
    <SquadContext.Provider value={{ players, addPlayer, updatePlayer, removePlayer }}>
      {children}
    </SquadContext.Provider>
  );
}

export function useSquad() {
  const ctx = useContext(SquadContext);
  if (!ctx) throw new Error("useSquad must be used within a SquadProvider");
  return ctx;
}
