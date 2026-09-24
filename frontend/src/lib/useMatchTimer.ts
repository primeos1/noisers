import { useEffect, useState } from "react";
import type { MatchDayGame } from "./matchDay";

type ClockFields = Pick<MatchDayGame, "clockStartedAt" | "clockElapsed">;

function elapsedAt(clock: ClockFields, now: number, gameSeconds: number) {
  const base = clock.clockElapsed ?? 0;
  const run = clock.clockStartedAt ? (now - clock.clockStartedAt) / 1000 : 0;
  return Math.min(gameSeconds, base + Math.max(0, run));
}

/**
 * The clock lives on the game record (persisted to the API), not in component
 * state, so it keeps running when the admin navigates away, reloads or logs out.
 */
export function useMatchTimer(
  game: MatchDayGame | null,
  save: (clock: ClockFields) => void,
  gameMinutes: number,
) {
  const gameSeconds = gameMinutes * 60;
  const [now, setNow] = useState(() => Date.now());
  const clockRunning = !!game?.clockStartedAt;

  useEffect(() => {
    if (!clockRunning) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [clockRunning]);

  const elapsedSeconds = game ? elapsedAt(game, Math.max(now, Date.now()), gameSeconds) : 0;
  const secondsLeft = Math.ceil(gameSeconds - elapsedSeconds);
  const isFinished = secondsLeft <= 0;
  const running = clockRunning && !isFinished;

  function start() {
    if (!game || running || isFinished) return;
    save({ clockStartedAt: Date.now(), clockElapsed: elapsedSeconds });
  }

  /** Clock fields for a stopped clock — merge into another game update to pause in the same save. */
  function stoppedClock(): ClockFields {
    return { clockStartedAt: null, clockElapsed: game ? elapsedAt(game, Date.now(), gameSeconds) : 0 };
  }

  function pause() {
    if (!game || !game.clockStartedAt) return;
    save(stoppedClock());
  }

  function reset() {
    if (!game) return;
    save({ clockStartedAt: null, clockElapsed: 0 });
  }

  const minute = Math.min(gameMinutes, Math.floor(elapsedSeconds / 60) + 1);

  return {
    secondsLeft: Math.max(0, secondsLeft),
    running,
    minute,
    start,
    pause,
    reset,
    stoppedClock,
    isFinished,
  };
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
