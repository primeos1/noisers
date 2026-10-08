import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import logoWhite from "../assets/brand/logo-white.png";
import { useAuth } from "../lib/AuthContext";
import TabBar from "./TabBar";
import {
  ChevronRightIcon,
  GridIcon,
  HomeIcon,
  MedalIcon,
  MegaphoneIcon,
  MoreIcon,
  PlayIcon,
  PulseIcon,
  ShieldIcon,
  ShirtIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
} from "./icons";

/** The public site's sections, also listed under "More" in the player area. */
export const publicLinks = [
  { label: "Home", to: "/", end: true, icon: <HomeIcon /> },
  { label: "Squad", to: "/squad", icon: <ShirtIcon /> },
  { label: "The Vale", to: "/the-vale", icon: <TrophyIcon /> },
  { label: "League", to: "/league", icon: <ShieldIcon /> },
  { label: "Noisers", to: "/noisers", icon: <MegaphoneIcon /> },
  { label: "Highlights", to: "/highlights", icon: <PlayIcon /> },
  { label: "Executives", to: "/executives", icon: <UsersIcon /> },
  { label: "Awards", to: "/awards", icon: <MedalIcon /> },
  { label: "Live Match", to: "/live", icon: <PulseIcon /> },
];

// Phones keep four sections in the dock; the rest sit behind "More".
const moreRoutes = ["/league", "/highlights", "/executives", "/awards", "/live"];
const tabLinks = publicLinks.filter((l) => !moreRoutes.includes(l.to));
const moreLinks = publicLinks.filter((l) => moreRoutes.includes(l.to));

const moreNotes: Record<string, string> = {
  "/league": "Six clubs, six kits, one table",
  "/highlights": "Goals, saves and match day clips",
  "/executives": "The committee that runs the club",
  "/awards": "The race for every honour",
  "/live": "Today's teams, the draw and live stats",
};

/**
 * Public site chrome. Desktop keeps the classic top nav; phones get a slim
 * translucent title bar plus a floating tab bar, like a native app.
 */
export default function Navbar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const onMorePage = moreRoutes.some((to) => pathname.startsWith(to));

  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`pt-safe fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled ? "glass-bar border-b border-ink-line/70" : "bg-gradient-to-b from-ink/70 to-transparent"
        }`}
      >
        <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:h-auto md:px-10 md:py-4">
          <Link to="/" className="flex items-center gap-2.5 md:gap-3">
            <img src={logoWhite} alt="Noisers FC crest" className="h-8 w-8 md:h-11 md:w-11" />
            <span className="font-display text-xl leading-none tracking-wide text-paper md:text-2xl">
              NOISERS FC
            </span>
          </Link>

          <ul className="hidden items-center gap-5 md:flex lg:gap-8">
            {publicLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `text-sm transition-colors hover:text-paper ${
                      isActive ? "text-paper" : "text-paper-dim"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {user ? (
            // Signed-in members get a way into their own area; the public
            // site stays open to them either way.
            <Link
              to={user.role === "admin" ? "/admin" : "/portal"}
              className="flex items-center gap-1.5 rounded-full bg-paper py-1.5 pl-2.5 pr-3.5 text-sm font-semibold text-ink transition-colors hover:bg-paper-dim md:rounded-none md:px-4 md:py-2"
            >
              <GridIcon className="h-4 w-4 md:hidden" />
              {user.role === "admin" ? "Admin" : "Player area"}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-none border border-paper/40 px-4 py-2 text-sm text-paper transition-colors hover:border-paper hover:bg-paper hover:text-ink md:block"
              >
                Club login
              </Link>

              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-full bg-paper/10 py-1.5 pl-2.5 pr-3.5 text-sm font-semibold text-paper ring-1 ring-white/10 md:hidden"
              >
                <UserIcon className="h-4 w-4" />
                Log in
              </Link>
            </>
          )}
        </nav>
      </header>

      <TabBar
        tabs={tabLinks}
        label="Main"
        extra={{ label: "More", icon: <MoreIcon />, active: moreOpen || onMorePage, onClick: () => setMoreOpen(true) }}
      />

      {moreOpen && (
        <div className="sheet-backdrop md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <p className="px-1 text-xs text-mist">More from Noisers FC</p>
            <ul className="mt-3 divide-y divide-ink-line overflow-hidden rounded-2xl bg-ink">
              {moreLinks.map((link) => {
                const awards = link.to === "/awards";
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className={`flex w-full items-center gap-3.5 px-4 py-3.5 text-left ${awards ? "aw-more-row" : ""}`}
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          awards ? "bg-justice text-ink" : "bg-ink-raised text-paper"
                        }`}
                      >
                        {link.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.95rem] text-paper">{link.label}</span>
                        <span className="block truncate text-xs text-mist">{moreNotes[link.to]}</span>
                      </span>
                      {(awards || link.to === "/league") && (
                        <span className="rounded-full bg-justice/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-justice">
                          {awards ? "New" : "Soon"}
                        </span>
                      )}
                      <ChevronRightIcon className="h-4 w-4 text-mist" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
