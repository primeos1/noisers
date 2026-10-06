import { useState } from "react";
import { isKeeper, type Player } from "../../lib/clubData";
import type { MatchDayGame, MatchDaySave } from "../../lib/matchDay";

let idCounter = 0;
function newSaveId() {
  idCounter += 1;
  return `s${Date.now()}${idCounter}`;
}

/**
 * Tap counters for each keeper on both sides of a game — saves, and
 * penalties saved (which count as saves too). Squad players with GK as their
 * main or second position are listed; a side without one picks whoever went
 * in goal. "+" adds at `minute`; "−" takes back that player's latest of that
 * kind.
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
  // Who went in goal for a side with no keeper, picked on this screen.
  const [standIns, setStandIns] = useState<[number | null, number | null]>([null, null]);

  function add(teamIndex: 0 | 1, playerId: number, penalty: boolean) {
    const save: MatchDaySave = { id: newSaveId(), teamIndex, playerId, minute, ...(penalty ? { penalty: true } : {}) };
    onChange((latest) => [...latest, save]);
  }

  function undo(playerId: number, penalty: boolean) {
    const last = saves.findLast((s) => s.playerId === playerId && !!s.penalty === penalty);
    if (last) onChange((latest) => latest.filter((s) => s.id !== last.id));
  }

  const squadPlayer = (id: unknown) => (typeof id === "number" ? players.find((p) => p.id === id) : undefined);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {([0, 1] as const).map((t) => {
        const onSide = game.teams[t].players.map(squadPlayer).filter((p): p is Player => !!p);
        const hasKeeper = onSide.some(isKeeper);
        // Keepers on the side now, anyone (subbed off or a stand-in) who already
        // made saves for it, and the stand-in picked here.
        const ids = new Set<number>([
          ...onSide.filter(isKeeper).map((p) => p.id),
          ...saves.filter((s) => s.teamIndex === t && typeof s.playerId === "number").map((s) => s.playerId as number),
          // Only while they're on this side — the next game may have new teams.
          ...onSide.filter((p) => p.id === standIns[t]).map((p) => p.id),
        ]);
        const goalies = [...ids].map(squadPlayer).filter((p): p is Player => !!p);
        const candidates = onSide.filter((p) => !ids.has(p.id));

        return (
          <div key={t}>
            <p className="text-xs uppercase tracking-wide text-mist">{game.teams[t].name}</p>
            {goalies.length === 0 && <p className="mt-2 text-sm text-mist">No keeper on this side.</p>}
            <ul className="mt-2 space-y-2">
              {goalies.map((goalie) => (
                <li key={goalie.id} className="rounded-lg bg-ink-raised p-2 pl-3">
                  <p className="truncate text-sm text-paper">
                    {goalie.name}
                    {!isKeeper(goalie) && <span className="ml-2 text-xs text-mist">in goal</span>}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([false, true] as const).map((penalty) => (
                      <Counter
                        key={String(penalty)}
                        label={penalty ? "Penalties" : "Saves"}
                        who={goalie.name}
                        kind={penalty ? "penalty save" : "save"}
                        count={saves.filter((s) => s.playerId === goalie.id && !!s.penalty === penalty).length}
                        onAdd={() => add(t, goalie.id, penalty)}
                        onUndo={() => undo(goalie.id, penalty)}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {!hasKeeper && candidates.length > 0 && (
              <label className="mt-2 block text-xs text-mist">
                {goalies.length ? "Someone else in goal?" : "Who's in goal?"}
                <select
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setStandIns((s) => (t === 0 ? [id, s[1]] : [s[0], id]));
                  }}
                  className="mt-1 block w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper"
                >
                  <option value="" disabled>
                    Pick a player
                  </option>
                  {candidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Counter({
  label,
  who,
  kind,
  count,
  onAdd,
  onUndo,
}: {
  label: string;
  who: string;
  kind: string;
  count: number;
  onAdd: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="min-w-0 flex-1 truncate text-xs text-mist">{label}</span>
      <button
        type="button"
        onClick={onUndo}
        disabled={count === 0}
        aria-label={`Take back a ${kind} by ${who}`}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-line text-lg text-paper-dim hover:text-paper disabled:opacity-40"
      >
        −
      </button>
      <span className="w-6 text-center font-display text-xl tabular-nums text-paper" aria-live="polite">
        {count}
      </span>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add a ${kind} by ${who}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-lg font-semibold text-ink"
      >
        +
      </button>
    </div>
  );
}
