import { Link } from "react-router-dom";

// Player / Committee switch shown at the top of both sign-in pages, so it's
// obvious there are two ways in and which one you're on. The highlight
// slides across from the other side when you switch.
export default function LoginSwitch({ active }: { active: "player" | "committee" }) {
  return (
    <nav aria-label="Choose how to sign in" className="login-switch" data-active={active}>
      <span className="login-switch-thumb" aria-hidden="true" />
      <Link
        to="/player-login"
        replace
        aria-current={active === "player" ? "page" : undefined}
        className="login-switch-option"
      >
        <span className="login-switch-title">Player</span>
        <span className="login-switch-sub">Squad passcode</span>
      </Link>
      <Link
        to="/login"
        replace
        aria-current={active === "committee" ? "page" : undefined}
        className="login-switch-option"
      >
        <span className="login-switch-title">Committee</span>
        <span className="login-switch-sub">Email and password</span>
      </Link>
    </nav>
  );
}
