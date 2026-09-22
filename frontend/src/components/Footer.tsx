import { Link } from "react-router-dom";
import logoWhite from "../assets/brand/logo-white.png";

export default function Footer() {
  return (
    <footer className="bg-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-16 md:flex-row md:items-start md:justify-between md:px-10">
        <div className="flex items-start gap-4">
          <img src={logoWhite} alt="Noisers FC crest" className="h-14 w-14" />
          <div>
            <p className="font-display text-2xl text-paper">NOISERS FC</p>
            <p className="mt-1 max-w-xs text-sm text-paper-dim">
              Est. 2021 · Vale 2 Zenith. Grassroots five-a-side football,
              run properly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <div>
            <p className="text-sm text-paper">Club</p>
            <ul className="mt-3 space-y-2 text-sm text-paper-dim">
              <li>
                <a href="#squad" className="hover:text-paper">
                  Squad
                </a>
              </li>
              <li>
                <a href="#matchday" className="hover:text-paper">
                  Fixtures &amp; results
                </a>
              </li>
              <li>
                <a href="#gallery" className="hover:text-paper">
                  Gallery
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm text-paper">Management</p>
            <ul className="mt-3 space-y-2 text-sm text-paper-dim">
              <li>
                <Link to="/login" className="hover:text-paper">
                  Club login
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-ink-line px-6 py-6 text-xs text-mist md:px-10">
        © {new Date().getFullYear()} Noisers FC. All rights reserved.
      </div>
    </footer>
  );
}
