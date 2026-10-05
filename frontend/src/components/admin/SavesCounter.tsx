import { isKeeper, type Player } from "../../lib/clubData";
import type { MatchDayGame, MatchDaySave } from "../../lib/matchDay";

let idCounter = 0;
function newSaveId() {
  idCounter += 1;
  return `s${Date.now()}${idCounter}`;
}

/**
 * A tap counter per keeper on each side of a game. Only squad players with
 * GK as their main or second position are listed — saves aren't logged for
 * anyone else. "+" adds a save at `minute`; "−" takes back that keeper's
 * latest one.
 */
export default function SavesCounter({
  game,
  players,
  minute,
  onChange,
}: {
  game: MatchDayGame;
  players: Player[];
  minute: number;
  /** Gets a change to make to the game's latest saves, so it can be re-applied. */
  onChange: (update: (saves: MatchDaySave[]) => MatchDaySave[]) => void;
}) {
  const saves = game.saves ?? [];

  function add(teamIndex: 0 | 1, playerId: number) {
    const save = { id: newSaveId(), teamIndex, playerId, minute };
    onChange((latest) => [...latest, save]);
  }

  function undo(playerId: number) {
    const last = saves.findLast((s) => s.playerId === playerId);
    if (last) onChange((latest) => latest.filter((s) => s.id !== last.id));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {([0, 1] as const).map((t) => {
        // Keepers on the side now, plus any subbed off who already made saves.
        const ids = new Set([...game.teams[t].players, ...saves.filter((s) => s.teamIndex === t).map((s) => s.playerId)]);
        const keepers = [...ids]
          .map((id) => (typeof id === "number" ? players.find((p) => p.id === id) : undefined))
          .filter((p): p is Player => !!p && isKeeper(p));
        return (
          <div key={t}>
            <p className="text-xs uppercase tracking-wide text-mist">{game.teams[t].name}</p>
            {keepers.length === 0 ? (
              <p className="mt-2 text-sm text-mist">No keeper on this side.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {keepers.map((keeper) => {
                  const count = saves.filter((s) => s.playerId === keeper.id).length;
                  return (
                    <li key={keeper.id} className="flex items-center gap-3 rounded-lg bg-ink-raised p-2 pl-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-paper">{keeper.name}</span>
                      <button
                        type="button"
                        onClick={() => undo(keeper.id)}
                        disabled={count === 0}
                        aria-label={`Take back a save by ${keeper.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-line text-lg text-paper-dim hover:text-paper disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-display text-2xl tabular-nums text-paper" aria-live="polite">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => add(t, keeper.id)}
                        aria-label={`Add a save by ${keeper.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-lg font-semibold text-ink"
                      >
                        +
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
