import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import logoWhite from "../../assets/brand/logo-white.png";
import { useAuth } from "../../lib/AuthContext";
import { WHATSAPP_NUMBER, WHATSAPP_URL } from "../../lib/contact";
import TabBar from "../TabBar";
import { publicLinks } from "../Navbar";
import { ChevronRightIcon, LogoutIcon, MoreIcon } from "../icons";

interface Tab {
  label: string;
  to: string;
  end: boolean;
  icon: ReactNode;
}

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
    {children}
  </svg>
);

// Shirt, clock, scoreboard, bars — the same menu as fsm's player side.
const squad: Tab = {
  label: "Squad",
  to: "/portal",
  end: true,
  icon: icon(<path d="M8 3 5 4.5 2 8l2.5 3L6 10v11h12V10l1.5 1L22 8l-3-3.5L16 3a4 4 0 0 1-8 0Z" />),
};
const history: Tab = {
  label: "History",
  to: "/portal/history",
  end: false,
  icon: icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </>,
  ),
};
const stats: Tab = {
  label: "Stats",
  to: "/portal/stats",
  end: false,
  icon: icon(
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>,
  ),
};
const matchIcon = icon(
  <>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <line x1="12" y1="6" x2="12" y2="18" />
  </>,
);

const rowClass = "flex w-full items-center gap-3.5 px-4 py-3.5 text-left text-[0.95rem]";
const rowIconClass = "flex h-8 w-8 items-center justify-center rounded-lg";

/**
 * Shell for the signed-in player side. Phones get a floating thumb dock at
 * the bottom; from md up the same tabs sit in the top bar. A "Match" tab
 * appears only while a match sheet is open, as on fsm. "More" opens the
 * public site's sections, so the rest of the club is a tap away.
 */
export default function PortalLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [location.pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const onMatch = matchPath("/portal/matches/:id", location.pathname);
  const tabs: Tab[] = onMatch
    ? [squad, history, { label: "Match", to: location.pathname, end: true, icon: matchIcon }, stats]
    : [squad, history, stats];

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-dvh bg-ink text-paper">
      <header className="pt-safe glass-bar sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 md:h-16">
          <Link to="/portal" className="flex items-center gap-2.5">
            <img src={logoWhite} alt="" className="h-8 w-8" />
            <span className="font-display text-xl font-extrabold leading-none text-paper">Noisers</span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full bg-ink-raised p-1 md:flex" aria-label="Player portal">
            {tabs.map((tab) => (
              <NavLink
                key={tab.label}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    isActive ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
          <Link
            to="/"
            className="hidden rounded-full px-3.5 py-2 text-sm text-paper-dim transition-colors hover:text-paper md:block"
          >
            Club site
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-full bg-ink-raised px-3.5 py-2 text-sm text-paper-dim transition-colors hover:text-paper"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
          </div>
        </div>
      </header>

      <main key={location.pathname} className="screen-in pb-tabbar mx-auto max-w-3xl px-4 pt-3 md:pb-16 md:pt-8">
        <Outlet />
        <p className="mt-10 border-t border-ink-line pt-4 text-center text-xs text-mist">
          Player support:{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-paper-dim underline underline-offset-4 hover:text-paper">
            {WHATSAPP_NUMBER}
          </a>{" "}
          (WhatsApp only)
        </p>
      </main>

      <TabBar
        tabs={tabs}
        label="Player portal"
        extra={{ label: "More", icon: <MoreIcon />, active: moreOpen, onClick: () => setMoreOpen(true) }}
      />

      {moreOpen && (
        <div className="sheet-backdrop md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="sheet" role="dialog" aria-label="Club site" onClick={(e) => e.stopPropagation()}>
            <p className="px-1 text-xs text-mist">Noisers FC</p>
            <ul className="mt-3 divide-y divide-ink-line overflow-hidden rounded-2xl bg-ink">
              {publicLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={`${rowClass} text-paper-dim`}>
                    <span className={`${rowIconClass} bg-ink-raised text-paper`}>{link.icon}</span>
                    <span className="flex-1">{link.label}</span>
                    <ChevronRightIcon className="h-4 w-4 text-mist" />
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-4 overflow-hidden rounded-2xl bg-ink">
              <li>
                <button type="button" onClick={handleLogout} className={`${rowClass} text-loss`}>
                  <span className={`${rowIconClass} bg-loss/15`}>
                    <LogoutIcon />
                  </span>
                  Log out
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
