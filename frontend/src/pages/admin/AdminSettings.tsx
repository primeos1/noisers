import { useState, type FormEvent } from "react";
import { useAuth } from "../../lib/AuthContext";
import { useSettings } from "../../lib/SettingsContext";
import { formatNaira } from "../../lib/cards";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper disabled:opacity-50";
const labelClass = "block text-sm text-paper-dim";

// Its own component, remounted (via `key`, below) once the real settings
// arrive, so local drafts start from live values without an effect
// syncing state after render.
function SettingsForm({ canEdit }: { canEdit: boolean }) {
  const { settings, loading, updateSettings } = useSettings();

  const [yellowFine, setYellowFine] = useState(settings.yellowCardFine);
  const [redFine, setRedFine] = useState(settings.redCardFine);
  const [teamSize, setTeamSize] = useState(settings.matchTeamSize);
  const [winGoals, setWinGoals] = useState(settings.matchWinGoals);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateSettings({
        yellowCardFine: yellowFine,
        redCardFine: redFine,
        matchTeamSize: teamSize,
        matchWinGoals: winGoals,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-10 max-w-2xl space-y-10">
      <div>
        <h2 className="font-display text-2xl text-paper">Card fines</h2>
        <p className="mt-1 text-sm text-paper-dim">
          Applied to every new card logged from Match Day or Cards. Existing
          cards keep the fine they were given.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Yellow card fine
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              className={inputClass}
              value={yellowFine}
              onChange={(e) => setYellowFine(Number(e.target.value))}
            />
            <span className="mt-1 block text-xs text-mist">{formatNaira(yellowFine)}</span>
          </label>
          <label className={labelClass}>
            Red card fine
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              className={inputClass}
              value={redFine}
              onChange={(e) => setRedFine(Number(e.target.value))}
            />
            <span className="mt-1 block text-xs text-mist">{formatNaira(redFine)}</span>
          </label>
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-paper">Match day defaults</h2>
        <p className="mt-1 text-sm text-paper-dim">
          Used the next time teams are randomized and a game is started —
          games already in progress aren't affected.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Players per team
            <input
              type="number"
              min={2}
              max={11}
              disabled={!canEdit}
              className={inputClass}
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
            />
          </label>
          <label className={labelClass}>
            Goals to win a game
            <input
              type="number"
              min={1}
              disabled={!canEdit}
              className={inputClass}
              value={winGoals}
              onChange={(e) => setWinGoals(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      {canEdit && (
        <button
          type="submit"
          disabled={saving || loading}
          className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
        </button>
      )}
    </form>
  );
}

export default function AdminSettings() {
  const { user, playerPasscode, setPlayerPasscode } = useAuth();
  const { loading } = useSettings();
  const canEdit = user?.staffRole !== "committee";

  const [passcodeDraft, setPasscodeDraft] = useState(playerPasscode);
  const [passcodeSaved, setPasscodeSaved] = useState(false);

  return (
    <div>
      <p className="text-sm text-paper-dim">Club configuration</p>
      <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">
        Settings
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-paper-dim">
        Fine amounts and match day defaults, shared across the whole club —
        change them here rather than in code.
      </p>

      {!canEdit && (
        <p className="mt-6 max-w-2xl border border-ink-line bg-ink-raised px-4 py-3 text-sm text-paper-dim">
          Committee accounts can view settings but not change them — ask an
          admin to update these.
        </p>
      )}

      <SettingsForm key={loading ? "loading" : "loaded"} canEdit={canEdit} />

      <div className="mt-12 max-w-md border-t border-ink-line pt-10">
        <h2 className="font-display text-2xl text-paper">Player portal access</h2>
        <p className="mt-2 text-sm text-paper-dim">
          One shared passcode for the whole squad — share it however you
          normally reach the team, so every player can sign in at{" "}
          <span className="text-paper">/player-login</span> and see everyone's
          profile, performance and disciplinary record.
        </p>
        <form
          className="mt-4 flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPlayerPasscode(passcodeDraft.trim() || playerPasscode);
            setPasscodeSaved(true);
            setTimeout(() => setPasscodeSaved(false), 2000);
          }}
        >
          <input
            type="text"
            value={passcodeDraft}
            onChange={(e) => setPasscodeDraft(e.target.value)}
            className="flex-1 border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper"
          />
          <button
            type="submit"
            className="border border-paper bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-transparent hover:text-paper"
          >
            {passcodeSaved ? "Saved" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
