import { useState } from "react";
import { useMatchDay } from "../../lib/MatchDayContext";
import { scoreOf } from "../../lib/matchDay";
import { eventGoals, eventParticipants, sortEvents } from "../../lib/portal";
import { Empty, Group, LiveTag, PageTitle, Row, Segmented } from "../../components/portal/ui";

type Filter = "all" | "ended" | "live";

export default function PortalHistory() {
  const { events, loading } = useMatchDay();
  const [filter, setFilter] = useState<Filter>("all");

  const sorted = sortEvents(events);
  const visible = sorted.filter((e) => filter === "all" || e.status === filter);
  const live = sorted.filter((e) => e.status === "live").length;

  return (
    <>
      <PageTitle title="Match history" sub={`${sorted.length} match day${sorted.length === 1 ? "" : "s"} so far`} />

      <Segmented<Filter>
        label="Show match days"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "ended", label: "Results" },
          { value: "live", label: live ? `Live (${live})` : "Live" },
        ]}
      />

      {visible.length === 0 ? (
        <Empty>
          {loading
            ? "Loading match days…"
            : filter === "live"
              ? "Nothing is being played right now."
              : "No match days yet. They'll show up here once the committee starts one."}
        </Empty>
      ) : (
        <Group>
          {visible.map((event) => (
            <Row key={event.id} to={`/portal/matches/${event.id}`} className="items-start">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-display text-2xl font-bold capitalize leading-tight text-paper">{event.title}</p>
                  {event.status === "live" && <LiveTag />}
                </div>
                <p className="text-sm capitalize text-mist">
                  {[event.date, event.venue].filter(Boolean).join(", ")}
                </p>
                {event.games.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {event.games.map((g) => (
                      <span key={g.id} className="rounded-lg bg-ink px-2 py-1 font-display text-base font-semibold tabular-nums leading-none text-paper-dim">
                        {scoreOf(g, 0)}–{scoreOf(g, 1)}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2.5 text-xs text-mist">
                  {event.games.length} game{event.games.length === 1 ? "" : "s"}, {eventGoals(event)} goals, {eventParticipants(event)} players
                </p>
              </div>
            </Row>
          ))}
        </Group>
      )}
    </>
  );
}
