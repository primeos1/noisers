import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logoWhite from "../assets/brand/logo-white.png";

const links = [
  { label: "Squad", href: "#squad" },
  { label: "Fixtures", href: "#matchday" },
  { label: "Gallery", href: "#gallery" },
  { label: "Club", href: "#story" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
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
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-paper-dim transition-colors hover:text-paper"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <Link
          to="/login"
          className="rounded-none border border-paper/40 px-4 py-2 text-sm text-paper transition-colors hover:border-paper hover:bg-paper hover:text-ink"
        >
          Club login
        </Link>
      </nav>
    </header>
  );
}
