import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { useSquad } from "../lib/SquadContext";
import { cards } from "../lib/cards";
import { useAuth } from "../lib/AuthContext";

const positionLabel: Record<string, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export default function PlayerPortal() {
  const { players } = useSquad();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const sorted = [...players].sort((a, b) => a.number - b.number);

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <Layout>
      <PageHeader
        eyebrow="Squad access"
        title="Player portal"
        description="Every player's profile, performance and disciplinary record — signed-in squad members only."
      />

      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-paper-dim">
              Want the charts and leaderboards too?{" "}
              <Link to="/performance" className="text-paper underline underline-offset-4 hover:text-paper-dim">
                Open the performance dashboard
              </Link>
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="border border-ink-line px-4 py-2 text-sm text-paper-dim transition-colors hover:border-paper/60 hover:text-paper"
            >
              Log out
            </button>
          </div>
        </div>
      </section>

      <section className="bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <div className="overflow-x-auto border border-ink-line">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-line text-xs uppercase tracking-wide text-mist">
                  <th className="px-4 py-3 font-normal">Player</th>
                  <th className="px-4 py-3 font-normal">Position</th>
                  <th className="px-4 py-3 font-normal">Rating</th>
                  <th className="px-4 py-3 font-normal">Apps</th>
                  <th className="px-4 py-3 font-normal">Goals</th>
                  <th className="px-4 py-3 font-normal">Assists</th>
                  <th className="px-4 py-3 font-normal">Clean sheets</th>
                  <th className="px-4 py-3 font-normal">Cards</th>
                  <th className="px-4 py-3 font-normal">Fines owed</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((player) => {
                  const playerCards = cards.filter((c) => c.playerNumber === player.number);
                  const yellow = playerCards.filter((c) => c.type === "yellow").length;
                  const red = playerCards.filter((c) => c.type === "red").length;
                  const owed = playerCards
                    .filter((c) => !c.paid)
                    .reduce((sum, c) => sum + c.fine, 0);

                  return (
                    <tr key={player.number} className="border-b border-ink-line last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={player.photo} alt="" className="duotone h-9 w-9 object-cover" />
                          <div>
                            <p className="text-paper">{player.name}</p>
                            <p className="text-xs text-mist">#{player.number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-paper-dim">{positionLabel[player.position]}</td>
                      <td className="px-4 py-3 text-paper-dim">{player.rating.toFixed(1)}</td>
                      <td className="px-4 py-3 text-paper-dim">{player.appearances}</td>
                      <td className="px-4 py-3 text-paper-dim">{player.goals}</td>
                      <td className="px-4 py-3 text-paper-dim">{player.assists}</td>
                      <td className="px-4 py-3 text-paper-dim">{player.cleanSheets}</td>
                      <td className="px-4 py-3">
                        {yellow === 0 && red === 0 ? (
                          <span className="text-mist">—</span>
                        ) : (
                          <span className="text-paper-dim">
                            {yellow > 0 && <span className="text-draw">{yellow}Y</span>}
                            {yellow > 0 && red > 0 && " · "}
                            {red > 0 && <span className="text-loss">{red}R</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {owed > 0 ? (
                          <span className="text-loss">£{owed}</span>
                        ) : (
                          <span className="text-win">£0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </Layout>
  );
}
