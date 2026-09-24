import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logoWhite from "../assets/brand/logo-white.png";
import TabBar from "./TabBar";
import { HomeIcon, PlayIcon, ShirtIcon, TrophyIcon, UserIcon } from "./icons";

const links = [
  { label: "Home", to: "/", end: true, icon: <HomeIcon /> },
  { label: "Squad", to: "/squad", icon: <ShirtIcon /> },
  { label: "The Vale", to: "/the-vale", icon: <TrophyIcon /> },
  { label: "Highlights", to: "/highlights", icon: <PlayIcon /> },
];

/**
 * Public site chrome. Desktop keeps the classic top nav; phones get a slim
 * translucent title bar plus a floating tab bar, like a native app.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

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

          <ul className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
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
        </nav>
      </header>

      <TabBar tabs={links} label="Main" />
    </>
  );
}
