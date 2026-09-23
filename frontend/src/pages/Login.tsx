import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import logoWhite from "../assets/brand/logo-white.png";
import { photos } from "../lib/photos";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const stageRef = useRef<HTMLDivElement>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (login(email, password)) {
      navigate(from, { replace: true });
    } else {
      setError("Enter both an email and a password to continue.");
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    stage.style.setProperty(
      "--spot-x",
      `${((event.clientX - rect.left) / rect.width) * 100}%`,
    );
    stage.style.setProperty(
      "--spot-y",
      `${((event.clientY - rect.top) / rect.height) * 100}%`,
    );
  }

  return (
    <div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink px-6 py-16"
    >
      <img
        src={photos.tunnel}
        alt=""
        aria-hidden="true"
        className="duotone absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="duotone-wash pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink via-ink/80 to-ink" />
      <div className="floodlight-sweep pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <Link
        to="/"
        className="animate-hero-in relative z-10 mb-10 flex items-center gap-3"
      >
        <img src={logoWhite} alt="Noisers FC crest" className="h-12 w-12" />
        <span className="font-display text-2xl tracking-wide text-paper">
          NOISERS FC
        </span>
        <span className="eq" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      </Link>

      <div className="animate-hero-in relative z-10 w-full max-w-sm [animation-delay:100ms]">
        <div className="relative border border-ink-line bg-ink-raised/90 p-8 backdrop-blur-sm">
          <span className="corner corner-tl" />
          <span className="corner corner-tr" />
          <span className="corner corner-bl" />
          <span className="corner corner-br" />

          <p className="text-xs uppercase tracking-[0.3em] text-mist">
            Access
          </p>
          <h1 className="reveal-text mt-2 font-display text-4xl text-paper">
            Club login
          </h1>
          <p className="mt-2 text-sm text-paper-dim">
            For committee and team management access.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <label className="group block">
              <span className="text-sm text-paper-dim">Email</span>
              <div className="relative mt-2">
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-ink-line bg-ink px-4 py-3 text-paper outline-none transition-colors duration-300 focus:border-paper"
                  placeholder="you@noisersfc.com"
                />
                <span className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] origin-left scale-x-0 bg-paper transition-transform duration-500 ease-out group-focus-within:scale-x-100" />
              </div>
            </label>

            <label className="group block">
              <span className="text-sm text-paper-dim">Password</span>
              <div className="relative mt-2">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-ink-line bg-ink px-4 py-3 text-paper outline-none transition-colors duration-300 focus:border-paper"
                  placeholder="••••••••"
                />
                <span className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] origin-left scale-x-0 bg-paper transition-transform duration-500 ease-out group-focus-within:scale-x-100" />
              </div>
            </label>

            {error && <p className="text-sm text-loss">{error}</p>}

            <button
              type="submit"
              className="shimmer-btn relative w-full overflow-hidden border border-paper bg-paper px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-transparent hover:text-paper"
            >
              <span className="relative z-10">Sign in</span>
            </button>
          </form>

          <p className="mt-6 text-xs text-mist">
            Admin accounts are provisioned by the club committee. This preview
            accepts any email and password — real Sanctum authentication
            lands once the club's backend is connected.
          </p>
        </div>
      </div>

      <p className="animate-hero-in relative z-10 mt-8 text-sm text-paper-dim [animation-delay:150ms]">
        Squad player?{" "}
        <Link to="/player-login" className="text-paper underline underline-offset-4 hover:text-paper-dim">
          Use the player login
        </Link>
      </p>

      <Link
        to="/"
        className="animate-hero-in relative z-10 mt-4 text-sm text-paper-dim transition-colors hover:text-paper [animation-delay:200ms]"
      >
        ← Back to the club site
      </Link>
    </div>
  );
}
