import { useState, type FormEvent } from "react";
import { useValeContent, type ValeContentData } from "../../lib/ValeContentContext";
import { useSquad } from "../../lib/SquadContext";
import ImageUploadField from "../../components/admin/ImageUploadField";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const textareaClass = `${inputClass} min-h-[6rem]`;
const labelClass = "block text-sm text-paper-dim";

function PlayerSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (playerId: number) => void;
}) {
  const { players } = useSquad();
  const sorted = [...players].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
  return (
    <label className={labelClass}>
      {label}
      <select className={inputClass} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={0}>— None —</option>
        {sorted.map((p) => (
          <option key={p.id} value={p.id}>
            #{p.number} {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

// Tick-box list of the squad — shirt numbers can repeat, so players are
// picked by name rather than typed in as numbers.
function PlayerChecklist({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number[];
  onChange: (playerIds: number[]) => void;
}) {
  const { players } = useSquad();
  const sorted = [...players].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
  return (
    <fieldset className="mt-4">
      <legend className={labelClass}>
        {label} <span className="text-mist">({value.length} picked)</span>
      </legend>
      <div className="mt-1 grid max-h-56 grid-cols-1 gap-x-4 overflow-y-auto border border-ink-line bg-ink p-2 sm:grid-cols-2">
        {sorted.map((p) => (
          <label key={p.id} className="flex items-center gap-2 py-1 text-sm text-paper-dim">
            <input
              type="checkbox"
              checked={value.includes(p.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((id) => id !== p.id))}
            />
            <span className="truncate">
              #{p.number} {p.name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ValeForm() {
  const { content, updateContent } = useValeContent();
  const [team, setTeam] = useState(content.teamOfTheWeek);
  const [potw, setPotw] = useState(content.playerOfTheWeek);
  const [improved, setImproved] = useState(content.mostImproved);
  const [leaders, setLeaders] = useState(content.weeklyLeaders);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const patch: Partial<ValeContentData> = {
        teamOfTheWeek: team,
        playerOfTheWeek: potw,
        mostImproved: improved,
        weeklyLeaders: leaders,
      };
      await updateContent(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save The Vale.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-10 max-w-2xl space-y-12">
      <div>
        <h2 className="font-display text-2xl text-paper">Team of the week</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Week label
            <input className={inputClass} value={team.week} onChange={(e) => setTeam({ ...team, week: e.target.value })} placeholder="Week 12" />
          </label>
          <label className={labelClass}>
            Date range
            <input className={inputClass} value={team.dateRange} onChange={(e) => setTeam({ ...team, dateRange: e.target.value })} placeholder="15–21 Sep 2026" />
          </label>
          <label className={labelClass}>
            Sessions won
            <input type="number" min={0} className={inputClass} value={team.sessionsWon} onChange={(e) => setTeam({ ...team, sessionsWon: Number(e.target.value) })} />
          </label>
          <label className={labelClass}>
            Sessions played
            <input type="number" min={0} className={inputClass} value={team.sessionsPlayed} onChange={(e) => setTeam({ ...team, sessionsPlayed: Number(e.target.value) })} />
          </label>
          <label className={labelClass}>
            Rival team
            <input className={inputClass} value={team.rivalTeam} onChange={(e) => setTeam({ ...team, rivalTeam: e.target.value })} placeholder="Team B" />
          </label>
          <label className={labelClass}>
            Score
            <input className={inputClass} value={team.score} onChange={(e) => setTeam({ ...team, score: e.target.value })} placeholder="2–1" />
          </label>
        </div>
        <PlayerChecklist
          label="Lineup"
          value={team.lineupPlayerIds}
          onChange={(ids) => setTeam({ ...team, lineupPlayerIds: ids })}
        />
        <div className="mt-4">
          <ImageUploadField
            label="Photo"
            value={team.photo}
            onChange={(url) => setTeam({ ...team, photo: url })}
            maxDim={1200}
            previewClassName="duotone h-16 w-28 shrink-0 border border-ink-line object-cover"
          />
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-paper">Player of the week</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <PlayerSelect label="Player" value={potw.playerId} onChange={(n) => setPotw({ ...potw, playerId: n })} />
          <label className={labelClass}>
            Week rating
            <input type="number" step="0.1" min="0" max="10" className={inputClass} value={potw.weekRating} onChange={(e) => setPotw({ ...potw, weekRating: Number(e.target.value) })} />
          </label>
        </div>
        <label className={`${labelClass} mt-4 block`}>
          Note
          <textarea className={textareaClass} value={potw.note} onChange={(e) => setPotw({ ...potw, note: e.target.value })} />
        </label>
      </div>

      <div>
        <h2 className="font-display text-2xl text-paper">Most improved player</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <PlayerSelect label="Player" value={improved.playerId} onChange={(n) => setImproved({ ...improved, playerId: n })} />
          <label className={labelClass}>
            Previous rating
            <input type="number" step="0.01" min="0" max="10" className={inputClass} value={improved.previousRating} onChange={(e) => setImproved({ ...improved, previousRating: Number(e.target.value) })} />
          </label>
          <label className={labelClass}>
            Current rating
            <input type="number" step="0.01" min="0" max="10" className={inputClass} value={improved.currentRating} onChange={(e) => setImproved({ ...improved, currentRating: Number(e.target.value) })} />
          </label>
        </div>
        <label className={`${labelClass} mt-4 block`}>
          Note
          <textarea className={textareaClass} value={improved.note} onChange={(e) => setImproved({ ...improved, note: e.target.value })} />
        </label>
      </div>

      <div>
        <h2 className="font-display text-2xl text-paper">Weekly leaders</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <PlayerSelect
            label="Top scorer"
            value={leaders.topScorer.playerId}
            onChange={(n) => setLeaders({ ...leaders, topScorer: { ...leaders.topScorer, playerId: n } })}
          />
          <label className={labelClass}>
            Goals
            <input
              type="number"
              min={0}
              className={inputClass}
              value={leaders.topScorer.value}
              onChange={(e) => setLeaders({ ...leaders, topScorer: { ...leaders.topScorer, value: Number(e.target.value) } })}
            />
          </label>
          <PlayerSelect
            label="Top assist"
            value={leaders.topAssist.playerId}
            onChange={(n) => setLeaders({ ...leaders, topAssist: { ...leaders.topAssist, playerId: n } })}
          />
          <label className={labelClass}>
            Assists
            <input
              type="number"
              min={0}
              className={inputClass}
              value={leaders.topAssist.value}
              onChange={(e) => setLeaders({ ...leaders, topAssist: { ...leaders.topAssist, value: Number(e.target.value) } })}
            />
          </label>
        </div>
        <PlayerChecklist
          label="Clean sheet leaders"
          value={leaders.cleanSheets}
          onChange={(ids) => setLeaders({ ...leaders, cleanSheets: ids })}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <PlayerSelect
            label="Roughest player"
            value={leaders.roughest.playerId}
            onChange={(n) => setLeaders({ ...leaders, roughest: { ...leaders.roughest, playerId: n } })}
          />
          <label className={labelClass}>
            Yellow cards
            <input
              type="number"
              min={0}
              className={inputClass}
              value={leaders.roughest.yellowCards}
              onChange={(e) => setLeaders({ ...leaders, roughest: { ...leaders.roughest, yellowCards: Number(e.target.value) } })}
            />
          </label>
          <label className={labelClass}>
            Red cards
            <input
              type="number"
              min={0}
              className={inputClass}
              value={leaders.roughest.redCards}
              onChange={(e) => setLeaders({ ...leaders, roughest: { ...leaders.roughest, redCards: Number(e.target.value) } })}
            />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save The Vale"}
      </button>
    </form>
  );
}

export default function AdminVale() {
  const { loading } = useValeContent();

  return (
    <div>
      <p className="text-sm text-paper-dim">Public site content</p>
      <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">The Vale</h1>
      <p className="mt-3 max-w-2xl text-sm text-paper-dim">
        This week's awards — update these after every set.
      </p>

      <ValeForm key={loading ? "loading" : "loaded"} />
    </div>
  );
}
