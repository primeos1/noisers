import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logoWhite from "../assets/brand/logo-white.png";

const links = [
  { label: "Home", to: "/" },
  { label: "Squad", to: "/squad" },
  { label: "The Vale", to: "/the-vale" },
  { label: "Highlights", to: "/highlights" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "bg-ink/95 border-b border-ink-line backdrop-blur"
          : "bg-gradient-to-b from-ink/70 to-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoWhite} alt="Noisers FC crest" className="h-11 w-11" />
          <span className="font-display text-2xl leading-none tracking-wide text-paper">
            NOISERS FC
          </span>
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === "/"}
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

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
        >
          <span
            className={`h-px w-6 bg-paper transition-transform duration-300 ${
              open ? "translate-y-[3.5px] rotate-45" : ""
            }`}
          />
          <span
            className={`h-px w-6 bg-paper transition-opacity duration-300 ${
              open ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`h-px w-6 bg-paper transition-transform duration-300 ${
              open ? "-translate-y-[5.5px] -rotate-45" : ""
            }`}
          />
        </button>
      </nav>

      <div
        className={`overflow-hidden border-t border-ink-line bg-ink/95 backdrop-blur transition-[max-height] duration-300 md:hidden ${
          open ? "max-h-96" : "max-h-0 border-t-0"
        }`}
      >
        <ul className="flex flex-col px-6 py-4">
          {links.map((link) => (
            <li key={link.to} className="border-b border-ink-line py-3 last:border-b-0">
              <NavLink
                to={link.to}
                end={link.to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `text-base ${isActive ? "text-paper" : "text-paper-dim"}`
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
          <li className="pt-4">
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block border border-paper/40 px-4 py-3 text-center text-sm text-paper"
            >
              Club login
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
