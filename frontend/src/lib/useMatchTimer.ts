import { useEffect, useRef, useState } from "react";

export const GAME_SECONDS = 10 * 60;

export function useMatchTimer() {
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  function start() {
    if (secondsLeft > 0) setRunning(true);
  }

  function pause() {
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(GAME_SECONDS);
  }

  const elapsedSeconds = GAME_SECONDS - secondsLeft;
  const minute = Math.min(10, Math.floor(elapsedSeconds / 60) + 1);

  return {
    secondsLeft,
    running,
    minute,
    start,
    pause,
    reset,
    isFinished: secondsLeft === 0,
  };
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
