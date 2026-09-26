import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import logoWhite from "../assets/brand/logo-white.png";
import { useAuth } from "../lib/AuthContext";
import { ApiError } from "../lib/api";
import LoginSwitch from "../components/LoginSwitch";

// Committee sign-in, set on a pitch at night. Two floodlight towers sweep
// the dark until their field is filled — left for email, right for
// password — then lock on. A wrong sign-in makes them flicker; a right one
// brings them up to full before the admin opens.

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported — the lights say it anyway.
  }
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function Tower({ side, on }: { side: "left" | "right"; on: boolean }) {
  return (
    <div className={`flood-tower flood-tower-${side}`} data-on={on} aria-hidden="true">
      <span className="flood-beam" />
      <svg viewBox="0 0 60 150" className="flood-mast">
        <line x1="30" y1="34" x2="30" y2="150" stroke="var(--color-ink-line)" strokeWidth="4" />
        <line x1="30" y1="60" x2="16" y2="150" stroke="var(--color-ink-line)" strokeWidth="2" />
        <line x1="30" y1="60" x2="44" y2="150" stroke="var(--color-ink-line)" strokeWidth="2" />
        <rect x="4" y="4" width="52" height="30" rx="3" fill="var(--color-ink-raised)" stroke="var(--color-ink-line)" strokeWidth="2" />
        {[0, 1, 2].map((col) =>
          [0, 1].map((row) => (
            <circle key={`${col}-${row}`} className="flood-lamp" cx={15 + col * 15} cy={13 + row * 12} r="5" />
          )),
        )}
      </svg>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flare, setFlare] = useState(false);
  const [flicker, setFlicker] = useState(0);

  const emailOn = /\S+@\S+\.\S+/.test(email.trim());
  const passwordOn = password.length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!emailOn || !passwordOn) {
      setError(!emailOn ? "Enter the email address you use for the club." : "Enter your password.");
      setFlicker((n) => n + 1);
      buzz(40);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      setFlare(true);
      buzz([20, 40, 20]);
      window.setTimeout(() => navigate(from, { replace: true }), reducedMotion() ? 0 : 900);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the club server. Check your connection and try again.");
      setFlicker((n) => n + 1);
      buzz([60, 40, 60]);
      setSubmitting(false);
    }
  }

  const fieldClass =
    "mt-1 w-full border-b-2 border-ink-line bg-transparent py-3 text-lg text-paper outline-none transition-colors duration-300 placeholder:text-mist/50 focus:border-paper";

  return (
    <div className="flood-page relative flex min-h-dvh flex-col overflow-hidden bg-ink text-paper" data-flare={flare}>
      {/* Lights, re-mounted on each failed try so the flicker replays. */}
      <div key={flicker} className="pointer-events-none absolute inset-0" data-flicker={flicker > 0}>
        <Tower side="left" on={emailOn || flare} />
        <Tower side="right" on={passwordOn || flare} />
      </div>

      {/* The pitch, in perspective under the lights. */}
      <svg
        className="flood-pitch pointer-events-none absolute inset-x-0 bottom-0 h-[20vh] w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g fill="none" stroke="rgba(246,246,243,0.1)" strokeWidth="1.2">
          <path d="M60 10 L340 10 L400 200 L0 200 Z" />
          <line x1="200" y1="10" x2="200" y2="200" />
          <ellipse cx="200" cy="80" rx="46" ry="16" />
        </g>
      </svg>
      <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between px-5 pt-5 md:px-10 md:pt-8">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoWhite} alt="Noisers FC" className="h-9 w-9" />
          <span className="font-display text-xl tracking-wide">Noisers FC</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-16 pt-36 md:pt-16">
        <LoginSwitch active="committee" />
        <h1 className="mt-8 font-display text-[clamp(2.4rem,11vw,3rem)] font-extrabold leading-none md:text-6xl">Committee sign-in</h1>
        <p className="mt-3 text-paper-dim">For staff running match days, cards and the club site.</p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
          <label className="block text-sm text-paper-dim">
            Email
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@noisersfc.com"
              className={fieldClass}
            />
          </label>

          <label className="block text-sm text-paper-dim">
            Password
            <span className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${fieldClass} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                className="absolute right-0 bottom-3 text-xs text-paper-dim underline-offset-4 hover:text-paper hover:underline"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>

          <p className="min-h-5 text-sm text-loss" role="alert">
            {error}
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="join-cta flood-cta w-full"
            data-ready={emailOn && passwordOn}
          >
            {flare ? "Lights on" : submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
