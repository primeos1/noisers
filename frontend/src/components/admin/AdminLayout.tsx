import { NavLink, Outlet, useNavigate } from "react-router-dom";
import logoWhite from "../../assets/brand/logo-white.png";
import { useAuth } from "../../lib/AuthContext";

const links = [
  { label: "Dashboard", to: "/admin", end: true },
  { label: "Squad", to: "/admin/squad", end: false },
  { label: "Matches", to: "/admin/matches", end: false },
  { label: "Match Day", to: "/admin/matchday", end: false },
  { label: "Cards", to: "/admin/cards", end: false },
  { label: "Reports", to: "/admin/reports", end: false },
  { label: "Home Page", to: "/admin/home-content", end: false },
  { label: "The Vale", to: "/admin/vale", end: false },
  { label: "Highlights", to: "/admin/highlights", end: false },
  { label: "Settings", to: "/admin/settings", end: false },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="flex min-h-screen bg-ink">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-line bg-ink-raised md:flex">
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

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink-line px-6 py-4 md:px-10">
          <div className="flex items-center gap-3 md:hidden">
            <img src={logoWhite} alt="Noisers FC crest" className="h-8 w-8" />
            <span className="font-display text-lg text-paper">NOISERS FC</span>
          </div>
          <div className="hidden md:block" />
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

        <nav className="flex gap-1 overflow-x-auto border-b border-ink-line px-4 py-2 md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `shrink-0 px-3 py-2 text-sm ${
                  isActive ? "bg-paper text-ink" : "text-paper-dim"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 px-6 py-10 md:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
