import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRef, useState, type FormEvent } from "react";
import logoWhite from "../assets/brand/logo-white.png";
import { useAuth } from "../lib/AuthContext";
import { ApiError } from "../lib/api";
import LoginSwitch from "../components/LoginSwitch";

// Player portal sign-in, built as a stadium scoreboard. The passcode is typed
// "into" the board: each character lights a bulb, the board answers with
// TRY AGAIN or WELCOME IN, and a right answer closes the gates behind them.

type BoardState = "idle" | "checking" | "wrong" | "right";

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported — the board says it anyway.
  }
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export default function PlayerLogin() {
  const { loginAsPlayer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/portal";

  const inputRef = useRef<HTMLInputElement>(null);
  const [passcode, setPasscode] = useState("");
  const [reveal, setReveal] = useState(false);
  const [focused, setFocused] = useState(false);
  const [board, setBoard] = useState<BoardState>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!passcode.trim()) {
      setError("Type the squad passcode first.");
      setBoard("wrong");
      buzz(40);
      inputRef.current?.focus();
      return;
    }
    setError("");
    setBoard("checking");
    try {
      await loginAsPlayer(passcode);
      setBoard("right");
      buzz([20, 40, 20]);
      // Let the gates close before moving on.
      window.setTimeout(() => navigate(from, { replace: true }), reducedMotion() ? 0 : 1100);
    } catch (err) {
      setBoard("wrong");
      buzz([60, 40, 60]);
      setError(err instanceof ApiError ? err.message : "Couldn't reach the club server. Check your connection and try again.");
    }
  }

  const headline =
    board === "right" ? "WELCOME IN" : board === "wrong" ? "TRY AGAIN" : board === "checking" ? "CHECKING" : "SQUAD ACCESS";
  const chars = [...passcode];

  return (
    <div className="board-page relative flex min-h-dvh flex-col overflow-hidden bg-ink text-paper">
      <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* The gates close behind the player once the passcode is right. */}
      <div className="board-gates pointer-events-none fixed inset-0 z-30" data-open={board === "right"} aria-hidden="true">
        <span className="board-gate board-gate-left" />
        <span className="board-gate board-gate-right" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 pt-5 md:px-10 md:pt-8">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoWhite} alt="Noisers FC" className="h-9 w-9" />
          <span className="font-display text-xl tracking-wide">Noisers FC</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pb-10 pt-8">
        <LoginSwitch active="player" />
        <h1 className="mt-8 font-display text-5xl font-extrabold leading-none md:text-6xl">Player portal</h1>
        <p className="mt-3 max-w-md text-paper-dim">
          One passcode for the whole squad. It opens everyone's stats, match history and fines.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8">
          {/* Tapping anywhere on the board focuses the real input underneath. */}
          <label className="board" data-state={board} data-focused={focused}>
            <span className="sr-only">Squad passcode</span>
            <input
              ref={inputRef}
              type={reveal ? "text" : "password"}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (board === "wrong") {
                  setBoard("idle");
                  setError("");
                }
                buzz(5);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="board-input"
              disabled={board === "checking" || board === "right"}
            />

            <span className="board-headline" aria-hidden="true">
              {headline.split("").map((ch, i) => (
                <span key={`${headline}-${i}`} className="board-letter" style={{ animationDelay: `${i * 35}ms` }}>
                  {ch === " " ? " " : ch}
                </span>
              ))}
            </span>

            <span className="board-row" aria-hidden="true">
              {chars.length === 0 && !focused ? (
                <span className="board-hint">Tap to type the passcode</span>
              ) : (
                chars.map((ch, i) =>
                  reveal ? (
                    <span key={i} className="board-char">
                      {ch}
                    </span>
                  ) : (
                    <span key={i} className="board-bulb" />
                  ),
                )
              )}
              {focused && board !== "right" && <span className="board-caret" />}
            </span>
          </label>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="min-h-5 text-sm text-loss" role="alert">
              {error}
            </p>
            <button
              type="button"
              onClick={() => {
                setReveal((r) => !r);
                inputRef.current?.focus();
              }}
              className="shrink-0 rounded-full border border-ink-line px-3 py-1.5 text-xs text-paper-dim transition-colors hover:border-paper hover:text-paper"
              aria-pressed={reveal}
            >
              {reveal ? "Hide passcode" : "Show passcode"}
            </button>
          </div>

          <button
            type="submit"
            disabled={board === "checking" || board === "right"}
            className="join-cta mt-6 w-full"
          >
            {board === "checking" ? "Checking…" : board === "right" ? "Opening…" : "Enter the portal"}
          </button>
        </form>

        <div className="mt-8 space-y-2 text-sm text-paper-dim">
          <p>
            New to the squad?{" "}
            <Link to="/join" className="text-paper underline underline-offset-4 hover:text-paper-dim">
              Add yourself
            </Link>
          </p>
          <p className="text-mist">No passcode? A committee member can give it to you.</p>
        </div>
      </main>
    </div>
  );
}
