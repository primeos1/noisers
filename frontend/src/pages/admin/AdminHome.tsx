import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import logoWhite from "../../assets/brand/logo-white.png";
import { useAuth } from "../../lib/AuthContext";
import { useSquad } from "../../lib/SquadContext";
import { useMatchDay } from "../../lib/MatchDayContext";
import { useHomeContent } from "../../lib/HomeContentContext";
import { scoreOf } from "../../lib/matchDay";
import { topByStat } from "../../lib/clubData";
import { photos } from "../../lib/photos";
import { outstandingFines, recentCards, formatNaira } from "../../lib/cards";
import { useCards } from "../../lib/CardsContext";
import {
  CalendarIcon,
  CardIcon,
  ChartIcon,
  ChevronRightIcon,
  GearIcon,
  ShirtIcon,
  TrophyIcon,
  WhistleIcon,
} from "../../components/icons";

const iconSm = "h-[18px] w-[18px]";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Stat({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  badge: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-ink-line bg-ink-raised p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.7rem] uppercase tracking-wide text-mist md:text-xs">{label}</p>
        {badge}
      </div>
      <p className="mt-3 truncate font-display text-3xl leading-none text-paper md:mt-4 md:text-4xl">{value}</p>
      {hint && <p className="mt-1.5 line-clamp-2 text-xs text-paper-dim md:text-sm">{hint}</p>}
    </div>
  );
}

function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper/10 text-paper">
      {children}
    </span>
  );
}

export default function AdminHome() {
  const { user } = useAuth();
  const { players } = useSquad();
  const { events } = useMatchDay();
  const { cards } = useCards();
  const { content } = useHomeContent();

  const liveEvent = events.find((e) => e.status === "live");
  const lastEvent = events[events.length - 1];
  const lastEventWithGame = [...events].reverse().find((e) => e.games.length > 0);
  const lastGame = lastEventWithGame ? lastEventWithGame.games[lastEventWithGame.games.length - 1] : undefined;
  const scorers = topByStat(players, "goals", 5);
  const [topScorer] = scorers;
  const fines = outstandingFines(cards);
  const unpaid = cards.filter((c) => !c.paid).length;
  const recent = recentCards(cards, 5);
  const firstName = user?.name?.split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const shortcuts = [
    { label: "Match Day", to: "/admin/matchday", photo: photos.stadiumFloodlights, icon: <WhistleIcon className={iconSm} />, meta: liveEvent ? "Live now" : "Start a session" },
    { label: "Squad", to: "/admin/squad", photo: photos.dribbleClose, icon: <ShirtIcon className={iconSm} />, meta: `${players.length} players` },
    { label: "Matches", to: "/admin/matches", photo: photos.ballInNet, icon: <CalendarIcon className={iconSm} />, meta: `${events.length} match days` },
    { label: "Cards", to: "/admin/cards", photo: photos.tackleChallenge, icon: <CardIcon className={iconSm} />, meta: `${unpaid} unpaid` },
    { label: "Reports", to: "/admin/reports", photo: photos.stadiumCrowd, icon: <ChartIcon className={iconSm} />, meta: "Season stats" },
    { label: "Settings", to: "/admin/settings", photo: photos.bootTexture, icon: <GearIcon className={iconSm} />, meta: "Fines & defaults" },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-ink-line bg-ink-raised">
        <img
          src={content.hero.imageUrl || photos.emptyPitchNight}
          alt=""
          className="duotone absolute inset-0 -z-20 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/75 to-ink/10 md:bg-linear-to-r md:via-ink/60 md:to-transparent" />
        <img
          src={logoWhite}
          alt=""
          className="pointer-events-none absolute -right-8 -top-8 -z-10 h-40 w-40 opacity-[0.08] md:right-8 md:top-1/2 md:h-64 md:w-64 md:-translate-y-1/2"
        />
        <div className="flex min-h-60 flex-col justify-end p-5 md:min-h-72 md:p-10">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-paper-dim md:text-xs">{today}</p>
          <h1 className="mt-2 font-display text-4xl leading-[0.95] text-paper md:text-6xl">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-2 max-w-md text-sm text-paper-dim md:text-base">
            {liveEvent
              ? `${liveEvent.title} is live at ${liveEvent.venue}.`
              : `${players.length} players · ${events.length} match days · ${unpaid} unpaid card${unpaid === 1 ? "" : "s"}`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              to="/admin/matchday"
              className="inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink transition-transform active:scale-[0.97]"
            >
              {liveEvent && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-loss" />
                </span>
              )}
              {liveEvent ? "Resume match day" : "Start a match day"}
            </Link>
            <Link
              to="/admin/squad"
              className="inline-flex items-center rounded-full bg-paper/10 px-5 py-2.5 text-sm font-medium text-paper backdrop-blur-sm transition-colors hover:bg-paper/20"
            >
              Manage squad
            </Link>
          </div>
        </div>
      </section>

      {/* Key numbers */}
      <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat
          label="Match days"
          value={events.length}
          hint={lastEvent ? `Last: ${lastEvent.title} · ${lastEvent.date}` : "None recorded yet"}
          badge={<IconBadge><CalendarIcon className="h-4 w-4" /></IconBadge>}
        />
        <Stat
          label="Last result"
          value={lastGame ? `${scoreOf(lastGame, 0)}–${scoreOf(lastGame, 1)}` : "—"}
          hint={lastGame ? `${lastGame.teams[0].name} vs ${lastGame.teams[1].name}` : "No games yet"}
          badge={<IconBadge><WhistleIcon className="h-4 w-4" /></IconBadge>}
        />
        <Stat
          label="Top scorer"
          value={topScorer ? topScorer.name : "—"}
          hint={topScorer ? `${topScorer.goals} goals · #${topScorer.number}` : undefined}
          badge={
            topScorer ? (
              <img src={topScorer.photo} alt="" className="duotone h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-ink-line" />
            ) : (
              <IconBadge><TrophyIcon className="h-4 w-4" /></IconBadge>
            )
          }
        />
        <Stat
          label="Unpaid fines"
          value={formatNaira(fines)}
          hint={`${unpaid} unpaid card${unpaid === 1 ? "" : "s"}`}
          badge={<IconBadge><CardIcon className="h-4 w-4" /></IconBadge>}
        />
      </section>

      {/* Shortcuts */}
      <section>
        <h2 className="font-display text-2xl text-paper">Quick access</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group relative isolate flex h-32 flex-col justify-between overflow-hidden rounded-2xl border border-ink-line bg-ink-raised p-4 transition-transform active:scale-[0.98] md:h-40 md:p-5"
            >
              <img
                src={s.photo}
                alt=""
                loading="lazy"
                className="duotone absolute inset-0 -z-20 h-full w-full object-cover opacity-50 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/60 to-ink/20" />
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-paper backdrop-blur-sm">
                {s.icon}
              </span>
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-xl leading-none text-paper md:text-2xl">{s.label}</p>
                  <p className="mt-1 truncate text-xs text-paper-dim">{s.meta}</p>
                </div>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-paper-dim transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:gap-8 lg:grid-cols-5">
        {/* Recent cards */}
        <section className="overflow-hidden rounded-2xl border border-ink-line bg-ink-raised lg:col-span-3">
          <div className="flex items-center justify-between px-4 py-4 md:px-5">
            <h2 className="font-display text-2xl text-paper">Recent cards</h2>
            <Link to="/admin/cards" className="text-sm text-paper-dim hover:text-paper">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="border-t border-ink-line px-4 py-6 text-sm text-paper-dim md:px-5">No cards logged.</p>
          ) : (
            <ul className="divide-y divide-ink-line border-t border-ink-line">
              {recent.map((card) => {
                const player = players.find((p) => p.number === card.playerNumber);
                return (
                  <li key={card.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                    <span className="relative shrink-0">
                      {player ? (
                        <img src={player.photo} alt="" className="duotone h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-xs text-mist">
                          #{card.playerNumber}
                        </span>
                      )}
                      <span
                        aria-label={card.type === "red" ? "Red card" : "Yellow card"}
                        className={`absolute -bottom-0.5 -right-0.5 h-4 w-3 rounded-[2px] ring-2 ring-ink-raised ${
                          card.type === "red" ? "bg-loss" : "bg-draw"
                        }`}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-paper">{player ? player.name : `#${card.playerNumber}`}</p>
                      <p className="truncate text-xs text-mist">
                        {card.reason} · {card.date}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm tabular-nums text-paper">{formatNaira(card.fine)}</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                          card.paid ? "bg-win/15 text-win" : "bg-loss/15 text-loss"
                        }`}
                      >
                        {card.paid ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Top scorers */}
        <section className="overflow-hidden rounded-2xl border border-ink-line bg-ink-raised lg:col-span-2">
          <div className="flex items-center justify-between px-4 py-4 md:px-5">
            <h2 className="font-display text-2xl text-paper">Top scorers</h2>
            <Link to="/admin/reports" className="text-sm text-paper-dim hover:text-paper">
              Reports →
            </Link>
          </div>
          {scorers.length === 0 ? (
            <p className="border-t border-ink-line px-4 py-6 text-sm text-paper-dim md:px-5">No players yet.</p>
          ) : (
            <ol className="divide-y divide-ink-line border-t border-ink-line">
              {scorers.map((player, i) => (
                <li key={player.number} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <span className="w-4 shrink-0 text-center font-display text-lg text-mist">{i + 1}</span>
                  <img src={player.photo} alt="" className="duotone h-10 w-10 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-paper">{player.name}</p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-line">
                      <div
                        className="h-full rounded-full bg-paper"
                        style={{ width: `${topScorer.goals ? (player.goals / topScorer.goals) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-2xl tabular-nums text-paper">{player.goals}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
