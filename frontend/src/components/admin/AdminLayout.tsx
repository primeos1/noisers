import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import logoWhite from "../../assets/brand/logo-white.png";
import { useAuth } from "../../lib/AuthContext";
import TabBar from "../TabBar";
import {
  CalendarIcon,
  CardIcon,
  ChartIcon,
  ChevronRightIcon,
  GearIcon,
  GlobeIcon,
  GridIcon,
  HomeIcon,
  LogoutIcon,
  MoreIcon,
  PlayIcon,
  ShirtIcon,
  TrophyIcon,
  WhistleIcon,
} from "../icons";

const links = [
  { label: "Dashboard", to: "/admin", end: true, icon: <GridIcon /> },
  { label: "Squad", to: "/admin/squad", end: false, icon: <ShirtIcon /> },
  { label: "Matches", to: "/admin/matches", end: false, icon: <CalendarIcon /> },
  { label: "Match Day", to: "/admin/matchday", end: false, icon: <WhistleIcon /> },
  { label: "Cards", to: "/admin/cards", end: false, icon: <CardIcon /> },
  { label: "Reports", to: "/admin/reports", end: false, icon: <ChartIcon /> },
  { label: "Home Page", to: "/admin/home-content", end: false, icon: <HomeIcon /> },
  { label: "The Vale", to: "/admin/vale", end: false, icon: <TrophyIcon /> },
  { label: "Highlights", to: "/admin/highlights", end: false, icon: <PlayIcon /> },
  { label: "Settings", to: "/admin/settings", end: false, icon: <GearIcon /> },
];

// The screens used most at the pitch sit in the phone tab bar; the rest live under "More".
const primary = ["/admin", "/admin/matchday", "/admin/squad", "/admin/cards"];
const tabLinks = primary.map((to) => {
  const link = links.find((l) => l.to === to)!;
  return to === "/admin" ? { ...link, label: "Home" } : link;
});
const moreLinks = links.filter((l) => !primary.includes(l.to));

const rowClass = "flex w-full items-center gap-3.5 px-4 py-3.5 text-left text-[0.95rem]";
const rowIconClass = "flex h-8 w-8 items-center justify-center rounded-lg";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const current = links.find((l) => matchPath({ path: l.to, end: l.end }, pathname));
  const onMorePage = moreLinks.some((l) => l.to === current?.to);

  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="flex min-h-dvh bg-ink">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-ink-line bg-ink-raised md:flex">
        <div className="flex items-center gap-3 border-b border-ink-line px-6 py-5">
          <img src={logoWhite} alt="Noisers FC crest" className="h-9 w-9" />
          <div>
            <p className="font-display text-lg leading-none text-paper">
              NOISERS FC
            </p>
            <p className="mt-1 text-xs text-mist">Committee tools</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6">
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `block px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-paper text-ink"
                        : "text-paper-dim hover:bg-ink hover:text-paper"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-ink-line px-3 py-4">
          <NavLink
            to="/"
            className="block px-3 py-2.5 text-sm text-paper-dim hover:text-paper"
          >
            ← View public site
          </NavLink>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {/* Phones: translucent title bar naming the current screen */}
        <header className="pt-safe glass-bar sticky top-0 z-30 border-b border-ink-line/70 md:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link to="/admin" className="flex min-w-0 items-center gap-2.5">
              <img src={logoWhite} alt="Noisers FC crest" className="h-7 w-7" />
              <span className="truncate font-display text-xl leading-none text-paper">
                {current?.label ?? "Committee"}
              </span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-paper/10 text-paper-dim"
            >
              <LogoutIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        <header className="hidden items-center justify-between border-b border-ink-line px-10 py-4 md:flex">
          <div />
          <div className="flex items-center gap-4">
            <p className="text-sm text-paper-dim">
              Signed in as <span className="text-paper">{user?.name}</span>
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="border border-ink-line px-4 py-2 text-sm text-paper-dim transition-colors hover:border-paper/60 hover:text-paper"
            >
              Log out
            </button>
          </div>
        </header>

        <main key={pathname} className="screen-in pb-tabbar min-w-0 flex-1 px-4 pt-6 md:px-10 md:py-10">
          <Outlet />
        </main>
      </div>

      <TabBar
        tabs={tabLinks}
        label="Committee tools"
        extra={{
          label: "More",
          icon: <MoreIcon />,
          active: moreOpen || onMorePage,
          onClick: () => setMoreOpen(true),
        }}
      />

      {moreOpen && (
        <div className="sheet-backdrop md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <p className="px-1 text-xs text-mist">
              Signed in as <span className="text-paper-dim">{user?.name}</span>
            </p>
            <ul className="mt-3 divide-y divide-ink-line overflow-hidden rounded-2xl bg-ink">
              {moreLinks.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className={({ isActive }) => `${rowClass} ${isActive ? "text-paper" : "text-paper-dim"}`}
                  >
                    <span className={`${rowIconClass} bg-ink-raised text-paper`}>{link.icon}</span>
                    <span className="flex-1">{link.label}</span>
                    <ChevronRightIcon className="h-4 w-4 text-mist" />
                  </NavLink>
                </li>
              ))}
            </ul>
            <ul className="mt-4 divide-y divide-ink-line overflow-hidden rounded-2xl bg-ink">
              <li>
                <Link to="/" className={`${rowClass} text-paper-dim`}>
                  <span className={`${rowIconClass} bg-ink-raised text-paper`}>
                    <GlobeIcon />
                  </span>
                  <span className="flex-1">View public site</span>
                  <ChevronRightIcon className="h-4 w-4 text-mist" />
                </Link>
              </li>
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
