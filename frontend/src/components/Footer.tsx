import { Link } from "react-router-dom";
import logoWhite from "../assets/brand/logo-white.png";
import { useHomeContent } from "../lib/HomeContentContext";

export default function Footer() {
  const { content } = useHomeContent();

  return (
    <footer className="bg-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-10 md:flex-row md:py-16 md:items-start md:justify-between md:px-10">
        <div className="flex items-start gap-4">
          <img src={logoWhite} alt="Noisers FC crest" className="h-14 w-14" />
          <div>
            <p className="font-display text-2xl text-paper">NOISERS FC</p>
            <p className="mt-1 max-w-xs text-sm text-paper-dim">
              {content.footer.tagline}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <div>
            <p className="text-sm text-paper">Club</p>
            <ul className="mt-3 space-y-2 text-sm text-paper-dim">
              <li>
                <Link to="/squad" className="hover:text-paper">
                  Squad
                </Link>
              </li>
              <li>
                <Link to="/the-vale" className="hover:text-paper">
                  The Vale
                </Link>
              </li>
              <li>
                <Link to="/highlights" className="hover:text-paper">
                  Highlights
                </Link>
              </li>
              <li>
                <Link to="/performance" className="hover:text-paper">
                  Performance
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm text-paper">Access</p>
            <ul className="mt-3 space-y-2 text-sm text-paper-dim">
              <li>
                <Link to="/login" className="hover:text-paper">
                  Club login
                </Link>
              </li>
              <li>
                <Link to="/player-login" className="hover:text-paper">
                  Player login
                </Link>
              </li>
              <li>
                <Link to="/join" className="hover:text-paper">
                  Join the squad
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-ink-line px-5 py-6 text-xs text-mist md:px-10">
        © {new Date().getFullYear()} {content.footer.copyright}
      </div>
    </footer>
  );
}
