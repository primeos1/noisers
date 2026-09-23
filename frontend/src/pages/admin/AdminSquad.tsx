import { useState } from "react";
import { useSquad } from "../../lib/SquadContext";
import { nextJerseyNumber, type Player } from "../../lib/clubData";
import PlayerFormModal from "../../components/admin/PlayerFormModal";

const positionLabel: Record<string, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export default function AdminSquad() {
  const { players, addPlayer, updatePlayer, removePlayer } = useSquad();
  const [editing, setEditing] = useState<Player | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);

  const sorted = [...players].sort((a, b) => a.number - b.number);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-paper-dim">Squad management</p>
          <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">
            Squad
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper"
        >
          + Add player
        </button>
      </div>

      <div className="mt-10 overflow-x-auto border border-ink-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-line text-xs uppercase tracking-wide text-mist">
              <th className="px-4 py-3 font-normal">#</th>
              <th className="px-4 py-3 font-normal">Player</th>
              <th className="px-4 py-3 font-normal">Position</th>
              <th className="px-4 py-3 font-normal">Rating</th>
              <th className="px-4 py-3 font-normal">Apps</th>
              <th className="px-4 py-3 font-normal">Goals</th>
              <th className="px-4 py-3 font-normal">Assists</th>
              <th className="px-4 py-3 font-normal">Clean sheets</th>
              <th className="px-4 py-3 font-normal" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((player) => (
              <tr key={player.number} className="border-b border-ink-line last:border-b-0">
                <td className="px-4 py-3 text-paper">{player.number}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={player.photo}
                      alt=""
                      className="duotone h-8 w-8 object-cover"
                    />
                    <span className="text-paper">{player.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-paper-dim">
                  {positionLabel[player.position]}
                </td>
                <td className="px-4 py-3 text-paper-dim">{player.rating.toFixed(1)}</td>
                <td className="px-4 py-3 text-paper-dim">{player.appearances}</td>
                <td className="px-4 py-3 text-paper-dim">{player.goals}</td>
                <td className="px-4 py-3 text-paper-dim">{player.assists}</td>
                <td className="px-4 py-3 text-paper-dim">{player.cleanSheets}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(player)}
                      className="text-paper-dim hover:text-paper"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(player)}
                      className="text-paper-dim hover:text-loss"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <PlayerFormModal
          initial={null}
          suggestedNumber={nextJerseyNumber(players)}
          onClose={() => setAdding(false)}
          onSubmit={(player) => {
            addPlayer(player);
            setAdding(false);
          }}
        />
      )}

      {editing && (
        <PlayerFormModal
          initial={editing}
          suggestedNumber={editing.number}
          onClose={() => setEditing(null)}
          onSubmit={(player) => {
            updatePlayer(editing.number, player);
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-4 backdrop-blur"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm border border-ink-line bg-ink-raised p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-paper">Remove player</h2>
            <p className="mt-2 text-sm text-paper-dim">
              Remove {confirmDelete.name} (#{confirmDelete.number}) from the
              squad? This can't be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removePlayer(confirmDelete.number);
                  setConfirmDelete(null);
                }}
                className="border border-loss bg-loss px-4 py-2 text-sm font-medium text-paper hover:bg-transparent hover:text-loss"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
