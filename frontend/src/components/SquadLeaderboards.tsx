import { useState } from "react";
import { Link } from "react-router-dom";
import { positionCodes, type Leaderboard } from "../lib/clubData";

/**
 * Season leaderboards for the squad page. On phones one board shows at a
 * time behind a swipeable tab strip; from lg up every board sits in a grid.
 */
export default function SquadLeaderboards({ boards }: { boards: Leaderboard[] }) {
  const [active, setActive] = useState(boards[0]?.id);

  return (
    <div className="mt-8 md:mt-10">
      <div
        role="tablist"
        aria-label="Leaderboards"
        className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:hidden"
      >
        {boards.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={active === b.id}
            aria-controls={`board-${b.id}`}
            onClick={() => setActive(b.id)}
            className={`shrink-0 border px-4 py-2 text-sm transition-colors ${
              active === b.id
                ? "border-paper bg-paper text-ink"
                : "border-ink-line text-paper-dim hover:border-paper/60 hover:text-paper"
            }`}
          >
            {b.title}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-px bg-ink-line lg:mt-0 lg:grid-cols-3">
        {boards.map((b) => (
          <BoardCard key={b.id} board={b} hiddenOnMobile={active !== b.id} />
        ))}
      </div>
    </div>
  );
}

function BoardCard({ board, hiddenOnMobile }: { board: Leaderboard; hiddenOnMobile: boolean }) {
  const [leader, ...rest] = board.rows;
  const max = Math.max(...board.rows.map((r) => r.value), 1);

  return (
    <section
      id={`board-${board.id}`}
      role="tabpanel"
      aria-label={board.title}
      className={`${hiddenOnMobile ? "hidden" : "flex"} flex-col bg-ink lg:flex`}
    >
      <h3 className="border-b border-ink-line px-4 py-4 text-xs uppercase tracking-wide text-mist md:px-6">
        {board.title}
      </h3>

      {!leader ? (
        <p className="px-4 py-10 text-sm text-paper-dim md:px-6">Nothing logged yet.</p>
      ) : (
        <>
          <Link
            to={`/squad/${leader.player.id}`}
            className="group flex items-center gap-4 border-b border-ink-line px-4 py-5 transition-colors hover:bg-ink-raised md:px-6"
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-ink-line">
              <img
                src={leader.player.photo}
                alt=""
                loading="lazy"
                className="duotone h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute bottom-0 left-0 bg-paper px-1.5 font-display text-sm leading-5 text-ink">1</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl leading-tight text-paper">{leader.player.name}</p>
              <p className="mt-1 text-xs text-mist">
                #{leader.player.number} · {positionCodes(leader.player)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-3xl leading-none text-paper">{leader.display ?? leader.value}</p>
              <p className="mt-1 text-xs text-mist">{board.unit}</p>
            </div>
          </Link>

          <ol className="flex-1">
            {rest.map((row, i) => (
              <li key={row.player.id}>
                <Link
                  to={`/squad/${row.player.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-raised md:px-6"
                >
                  <span className="w-4 shrink-0 text-sm tabular-nums text-mist">{i + 2}</span>
                  <img
                    src={row.player.photo}
                    alt=""
                    loading="lazy"
                    className="duotone h-9 w-9 shrink-0 border border-ink-line object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-paper">{row.player.name}</p>
                    <div className="mt-1.5 h-1 w-full bg-ink-line">
                      <div className="h-full bg-paper/60" style={{ width: `${Math.max((row.value / max) * 100, 4)}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 pl-2 text-sm tabular-nums text-paper">{row.display ?? row.value}</span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
