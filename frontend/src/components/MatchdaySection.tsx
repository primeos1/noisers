import { photos } from "../lib/photos";
import { useMatchDay } from "../lib/MatchDayContext";
import { allGames, participantName, scoreOf } from "../lib/matchDay";
import { useSquad } from "../lib/SquadContext";

export default function MatchdaySection() {
  const { events } = useMatchDay();
  const { players } = useSquad();
  const last = allGames(events).pop();

  return (
    <section id="matchday" className="border-b border-ink-line">
      <div className="mx-auto grid max-w-7xl md:grid-cols-2">
        <div className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden border-b border-ink-line p-10 md:border-b-0 md:border-r">
          <img
            src={photos.emptyPitchNight}
            alt="Empty floodlit pitch before kick-off"
            className="duotone absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="duotone-wash pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
          <div className="relative z-10">
            <p className="text-sm text-paper-dim">How match day works</p>
            <h3 className="mt-3 font-display text-4xl text-paper md:text-5xl">
              No opponent. Just the squad.
            </h3>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-paper-dim">
              Every session, whoever's present gets split into balanced
              six-a-side teams — random, by rating, or by position — then it's
              first to two goals on a ten-minute clock. Goals, assists and
              cards all get logged as they happen.
            </p>
          </div>
        </div>

        <div className="flex min-h-[26rem] flex-col justify-center bg-ink-raised p-10">
          <p className="text-sm text-paper-dim">Latest match day</p>
          {last ? (
            <>
              <div className="mt-4 flex items-baseline gap-4">
                <span className="font-display text-6xl text-paper md:text-7xl">
                  {scoreOf(last.game, 0)}–{scoreOf(last.game, 1)}
                </span>
                <span className="text-lg text-paper-dim">
                  {last.game.teams[0].name} v {last.game.teams[1].name}
                </span>
              </div>
              <p className="mt-2 text-sm text-mist">{last.event.date}</p>

              {last.game.goals.length > 0 && (
                <div className="mt-8 border-t border-ink-line pt-6">
                  <p className="text-sm text-paper-dim">Scorers</p>
                  <ul className="mt-3 space-y-2 text-paper">
                    {last.game.goals.map((g) => (
                      <li key={g.id} className="text-sm">
                        {participantName(players, last.event.guests, g.playerId)} {g.minute}'
                        {g.ownGoal && <span className="text-mist"> (o.g.)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 text-paper-dim">No match days logged yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
