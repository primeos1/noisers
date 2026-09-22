import { Link } from "react-router-dom";
import logoWhite from "../assets/brand/logo-white.png";

export default function Login() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6">
      <Link to="/" className="mb-10 flex items-center gap-3">
        <img src={logoWhite} alt="Noisers FC crest" className="h-12 w-12" />
        <span className="font-display text-2xl tracking-wide text-paper">
          NOISERS FC
        </span>
      </Link>

      <div className="w-full max-w-sm border border-ink-line bg-ink-raised p-8">
        <h1 className="font-display text-3xl text-paper">Club login</h1>
        <p className="mt-2 text-sm text-paper-dim">
          For committee and team management access.
        </p>

        <form className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm text-paper-dim">Email</span>
            <input
              type="email"
              autoComplete="email"
              className="mt-2 w-full border border-ink-line bg-ink px-4 py-3 text-paper outline-none focus:border-paper"
              placeholder="you@noisersfc.com"
            />
          </label>

          <label className="block">
            <span className="text-sm text-paper-dim">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full border border-ink-line bg-ink px-4 py-3 text-paper outline-none focus:border-paper"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled
            className="w-full border border-paper/40 bg-paper/10 px-4 py-3 text-sm text-paper-dim"
          >
            Sign in — connecting soon
          </button>
        </form>

        <p className="mt-6 text-xs text-mist">
          Admin accounts are provisioned by the club committee. The sign-in
          will go live once the club's backend is connected.
        </p>
      </div>

      <Link to="/" className="mt-8 text-sm text-paper-dim hover:text-paper">
        ← Back to the club site
      </Link>
    </div>
  );
}
