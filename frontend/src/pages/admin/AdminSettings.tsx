import { useEffect, useState, type ReactNode } from "react";
import Modal from "../../components/admin/Modal";
import { useAuth } from "../../lib/AuthContext";
import { apiFetch } from "../../lib/api";
import { DEFAULT_RATING_WEIGHTS, useSettings, type ClubSettings } from "../../lib/SettingsContext";
import { useMatchDay } from "../../lib/MatchDayContext";
import { useSquad } from "../../lib/SquadContext";
import { useCards } from "../../lib/CardsContext";
import { useValeContent } from "../../lib/ValeContentContext";
import { formatNaira } from "../../lib/cards";
import type { MatchDayEvent, TeamMode } from "../../lib/matchDay";

const inputClass =
  "mt-1 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper disabled:opacity-50";
const labelClass = "block text-sm text-paper-dim";

const sections = [
  { id: "discipline", label: "Discipline" },
  { id: "match-day", label: "Match day" },
  { id: "ratings", label: "Player ratings" },
  { id: "vale", label: "The Vale" },
  { id: "portal", label: "Player portal" },
  { id: "danger", label: "Danger zone" },
];

const teamModes: { value: TeamMode; label: string; hint: string }[] = [
  { value: "random", label: "Random", hint: "Just a shuffle" },
  { value: "rating", label: "By rating", hint: "Even out strength" },
  { value: "position", label: "By position", hint: "Even out GK/DEF/MID/FWD" },
];

function Section({
  id,
  title,
  description,
  tone = "default",
  children,
}: {
  id: string;
  title: string;
  description: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 rounded-2xl border bg-ink-raised p-4 md:p-6 ${
        tone === "danger" ? "border-loss/40" : "border-ink-line"
      }`}
    >
      <h2 className={`font-display text-2xl ${tone === "danger" ? "text-loss" : "text-paper"}`}>{title}</h2>
      <p className="mt-1 text-sm text-paper-dim">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// The public sign-up link — shared with new players so they can add
// themselves (they still need the squad passcode above).
function JoinLink() {
  // Always the public site, so a link copied from a local admin still works
  // for players. VITE_SITE_URL can point it elsewhere (e.g. a staging site).
  const url = `${import.meta.env.VITE_SITE_URL ?? "https://noisersfc.com"}/join`;
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard blocked — the link is still selectable in the field.
      });
  }

  return (
    <div className="mt-5">
      <span className={labelClass}>Squad sign-up link</span>
      <div className="mt-1 flex gap-2">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className={`${inputClass} mt-0 font-mono`}
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg border border-ink-line px-3 py-2 text-sm text-paper transition-colors hover:border-paper"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 text-xs text-mist">
        Share this with new players. They add their own name, number and position using the squad passcode.
      </p>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-ink px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-paper">{label}</p>
        <p className="mt-0.5 text-xs text-mist">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-win" : "bg-ink-line"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-paper shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  min,
  max,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={`${inputClass} ${suffix ? "pr-14" : ""}`}
          value={Number.isNaN(value) ? "" : value}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 mt-0.5 -translate-y-1/2 text-xs text-mist">
            {suffix}
          </span>
        )}
      </span>
      {hint && <span className="mt-1 block text-xs text-mist">{hint}</span>}
    </label>
  );
}

function signed(n: number) {
  const v = Number.isNaN(n) ? 0 : n;
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;
}

// Its own component, remounted (via `key`, below) once the real settings
// arrive, so the draft starts from live values without an effect syncing
// state after render.
function SettingsForm({ canEdit, passcode }: { canEdit: boolean; passcode: string }) {
  const { settings, loading, updateSettings } = useSettings();
  const { user } = useAuth();
  const [playerPasscode, setPlayerPasscode] = useState(passcode);

  const [draft, setDraft] = useState<ClubSettings>(settings);
  const [passcodeDraft, setPasscodeDraft] = useState(playerPasscode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const changed = (Object.keys(draft) as (keyof ClubSettings)[]).filter((k) => draft[k] !== settings[k]);
  const passcodeChanged = passcodeDraft.trim() !== "" && passcodeDraft.trim() !== playerPasscode;
  const dirty = changed.length > 0 || passcodeChanged;

  function set<K extends keyof ClubSettings>(key: K, value: ClubSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    const invalid = changed.find((k) => typeof draft[k] === "number" && Number.isNaN(draft[k]));
    if (invalid) {
      setError("Fill in every number before saving.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (changed.length > 0) {
        await updateSettings(Object.fromEntries(changed.map((k) => [k, draft[k]])));
      }
      if (passcodeChanged) {
        const res = await apiFetch<{ passcode: string }>("/settings/passcode", {
          method: "PUT",
          body: JSON.stringify({ passcode: passcodeDraft.trim() }),
        });
        setPlayerPasscode(res.passcode);
        setPasscodeDraft(res.passcode);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save settings.");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(settings);
    setPasscodeDraft(playerPasscode);
    setError("");
  }

  const off = !canEdit;
  const exampleDefender = draft.ratingWin + draft.ratingCleanSheetDef + draft.ratingAssist;
  const exampleStriker = draft.ratingGoal * 2 - draft.ratingLoss;

  return (
    <div className="lg:grid lg:grid-cols-[12rem_1fr] lg:gap-10">
      {/* Section menu: scrolling chips on phones, sticky list on desktop */}
      <nav aria-label="Settings sections" className="-mx-4 mb-6 overflow-x-auto px-4 lg:mx-0 lg:mb-0 lg:px-0">
        <ul className="flex gap-2 lg:sticky lg:top-10 lg:flex-col lg:gap-1">
          {sections.filter((s) => canEdit || s.id !== "danger").map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                className={`block rounded-full border border-ink-line px-3.5 py-1.5 text-sm whitespace-nowrap lg:rounded-lg lg:border-0 lg:px-3 lg:py-2 lg:hover:bg-ink-raised ${
                  s.id === "danger" ? "text-loss" : "text-paper-dim hover:text-paper"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 max-w-3xl space-y-5 md:space-y-6">
        {user && off && (
          <p className="rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm text-paper-dim">
            Committee accounts can view settings but not change them — ask an admin to update these.
          </p>
        )}

        <Section
          id="discipline"
          title="Discipline"
          description="Fines for cards. Changing an amount only affects cards logged from now on — existing cards keep their fine."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Yellow card fine"
              value={draft.yellowCardFine}
              onChange={(v) => set("yellowCardFine", v)}
              disabled={off}
              min={0}
              step={500}
              suffix="₦"
              hint={formatNaira(draft.yellowCardFine || 0)}
            />
            <NumberField
              label="Red card fine"
              value={draft.redCardFine}
              onChange={(v) => set("redCardFine", v)}
              disabled={off}
              min={0}
              step={500}
              suffix="₦"
              hint={formatNaira(draft.redCardFine || 0)}
            />
          </div>
          <div className="mt-4">
            <Toggle
              label="Fine cards shown during match day"
              hint="When a match day ends, every card given to a squad player becomes a fine on the Cards page."
              checked={draft.finesFromMatchDay}
              disabled={off}
              onChange={(v) => set("finesFromMatchDay", v)}
            />
          </div>
        </Section>

        <Section
          id="match-day"
          title="Match day"
          description="Defaults for new match days and games. Games already in progress keep the rules they started with, except the clock length."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              label="Players per team"
              value={draft.matchTeamSize}
              onChange={(v) => set("matchTeamSize", v)}
              disabled={off}
              min={2}
              max={11}
            />
            <NumberField
              label="Goals to win a game"
              value={draft.matchWinGoals}
              onChange={(v) => set("matchWinGoals", v)}
              disabled={off}
              min={1}
              max={20}
            />
            <NumberField
              label="Game length"
              value={draft.matchGameMinutes}
              onChange={(v) => set("matchGameMinutes", v)}
              disabled={off}
              min={1}
              max={90}
              suffix="min"
            />
          </div>
          <p className="mt-2 text-xs text-mist">
            A game ends when a team reaches {draft.matchWinGoals || "–"} goal{draft.matchWinGoals === 1 ? "" : "s"} or the{" "}
            {draft.matchGameMinutes || "–"}-minute clock runs out, whichever comes first.
          </p>

          <p className="mt-5 text-sm text-paper-dim">How teams are picked by default</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {teamModes.map((m) => (
              <button
                key={m.value}
                type="button"
                disabled={off}
                onClick={() => set("matchDefaultTeamMode", m.value)}
                aria-pressed={draft.matchDefaultTeamMode === m.value}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                  draft.matchDefaultTeamMode === m.value
                    ? "border-paper bg-paper text-ink"
                    : "border-ink-line bg-ink text-paper-dim hover:text-paper"
                }`}
              >
                <span className="block text-sm font-medium">{m.label}</span>
                <span
                  className={`mt-0.5 hidden text-xs sm:block ${
                    draft.matchDefaultTeamMode === m.value ? "text-ink/70" : "text-mist"
                  }`}
                >
                  {m.hint}
                </span>
              </button>
            ))}
          </div>

          <label className={`${labelClass} mt-5`}>
            Default venue
            <input
              type="text"
              disabled={off}
              className={inputClass}
              value={draft.matchDefaultVenue}
              onChange={(e) => set("matchDefaultVenue", e.target.value)}
              placeholder="e.g. Zenith Astro, Pitch 2"
            />
            <span className="mt-1 block text-xs text-mist">Pre-filled when starting a new match day. Leave blank for none.</span>
          </label>
        </Section>

        <Section
          id="ratings"
          title="Player ratings"
          description="Ratings run from 4.0 to 9.5 and move after every match day based on results and contributions."
        >
          <Toggle
            label="Update ratings automatically"
            hint="When off, ratings only change when you edit a player by hand."
            checked={draft.ratingsEnabled}
            disabled={off}
            onChange={(v) => set("ratingsEnabled", v)}
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Starting rating for new players"
              value={draft.ratingNewPlayer}
              onChange={(v) => set("ratingNewPlayer", v)}
              disabled={off}
              min={4}
              max={9.5}
              step={0.1}
            />
            <NumberField
              label="Most a rating can move in one match day"
              value={draft.ratingMaxSwing}
              onChange={(v) => set("ratingMaxSwing", v)}
              disabled={off || !draft.ratingsEnabled}
              min={0.05}
              max={2}
              step={0.05}
              suffix="±"
            />
          </div>

          <fieldset disabled={off || !draft.ratingsEnabled} className="mt-6 disabled:opacity-50">
            <legend className="text-sm text-paper">Points per game</legend>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <NumberField label="Win" value={draft.ratingWin} onChange={(v) => set("ratingWin", v)} disabled={off} min={0} max={1} step={0.01} suffix="+" />
              <NumberField label="Loss" value={draft.ratingLoss} onChange={(v) => set("ratingLoss", v)} disabled={off} min={0} max={1} step={0.01} suffix="−" />
              <NumberField label="Goal" value={draft.ratingGoal} onChange={(v) => set("ratingGoal", v)} disabled={off} min={0} max={1} step={0.01} suffix="+" />
              <NumberField label="Assist" value={draft.ratingAssist} onChange={(v) => set("ratingAssist", v)} disabled={off} min={0} max={1} step={0.01} suffix="+" />
              <NumberField label="Own goal" value={draft.ratingOwnGoal} onChange={(v) => set("ratingOwnGoal", v)} disabled={off} min={0} max={1} step={0.01} suffix="−" />
              <NumberField label="Yellow card" value={draft.ratingYellowCard} onChange={(v) => set("ratingYellowCard", v)} disabled={off} min={0} max={1} step={0.01} suffix="−" />
              <NumberField label="Red card" value={draft.ratingRedCard} onChange={(v) => set("ratingRedCard", v)} disabled={off} min={0} max={1} step={0.01} suffix="−" />
            </div>

            <p className="mt-6 text-sm text-paper">Clean sheet bonus by position</p>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <NumberField label="Goalkeeper" value={draft.ratingCleanSheetGk} onChange={(v) => set("ratingCleanSheetGk", v)} disabled={off} min={0} max={1} step={0.01} suffix="+" />
              <NumberField label="Defender" value={draft.ratingCleanSheetDef} onChange={(v) => set("ratingCleanSheetDef", v)} disabled={off} min={0} max={1} step={0.01} suffix="+" />
              <NumberField label="Midfielder" value={draft.ratingCleanSheetMid} onChange={(v) => set("ratingCleanSheetMid", v)} disabled={off} min={0} max={1} step={0.01} suffix="+" />
              <NumberField label="Forward" value={draft.ratingCleanSheetFwd} onChange={(v) => set("ratingCleanSheetFwd", v)} disabled={off} min={0} max={1} step={0.01} suffix="+" />
            </div>

            <div className="mt-5 rounded-xl bg-ink px-4 py-3 text-xs text-paper-dim">
              <p className="text-paper">Example, before scaling</p>
              <ul className="mt-1.5 space-y-1">
                <li>
                  A defender who wins 2–0 and assists once: <span className="tabular-nums text-win">{signed(exampleDefender)}</span>
                </li>
                <li>
                  A forward who scores twice but loses 2–3: <span className="tabular-nums text-paper">{signed(exampleStriker)}</span>
                </li>
              </ul>
              <p className="mt-1.5 text-mist">
                Gains shrink as a rating nears 9.5 and losses shrink near 4.0, so ratings drift back to the middle unless a player keeps performing.
              </p>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, ...DEFAULT_RATING_WEIGHTS }))}
                className="mt-4 text-sm text-paper-dim underline underline-offset-4 hover:text-paper"
              >
                Restore default points
              </button>
            )}
          </fieldset>
        </Section>

        <Section
          id="vale"
          title="The Vale"
          description="The weekly awards page: team of the week, player of the week, most improved and the weekly leaders."
        >
          <Toggle
            label="Update awards automatically"
            hint="When a match day ends, rebuild The Vale from its results. Turn off to manage The Vale entirely by hand."
            checked={draft.valeAutoAwards}
            disabled={off}
            onChange={(v) => set("valeAutoAwards", v)}
          />
        </Section>

        <Section
          id="portal"
          title="Player portal"
          description="One shared passcode for the whole squad. Players sign in at /player-login to see everyone's profile, performance and disciplinary record."
        >
          <label className={labelClass}>
            Squad passcode
            <input
              type="text"
              disabled={off}
              value={passcodeDraft}
              onChange={(e) => setPasscodeDraft(e.target.value)}
              className={`${inputClass} font-mono tracking-wider`}
            />
          </label>
          <JoinLink />
        </Section>

        {canEdit && (
          <Section
            id="danger"
            title="Danger zone"
            tone="danger"
            description="Permanent actions. These can't be undone."
          >
            <DeleteMatchDays />
          </Section>
        )}

        {/* Save bar — sits above the phone tab bar, only when there's something to save */}
        {canEdit && (dirty || saved || error) && (
          <div className="sticky bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.5rem)] z-20 md:bottom-6">
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
              <p className={`min-w-0 flex-1 truncate text-sm ${error ? "text-loss" : "text-paper-dim"}`}>
                {error ||
                  (saved && !dirty
                    ? "Settings saved"
                    : `${changed.length + (passcodeChanged ? 1 : 0)} unsaved change${changed.length + (passcodeChanged ? 1 : 0) === 1 ? "" : "s"}`)}
              </p>
              {dirty && (
                <>
                  <button
                    type="button"
                    onClick={discard}
                    disabled={saving}
                    className="shrink-0 px-2 text-sm text-paper-dim hover:text-paper disabled:opacity-60"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="shrink-0 rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function eventSummary(event: MatchDayEvent) {
  const finished = event.games.filter((g) => g.status === "finished");
  return {
    games: finished.length,
    goals: finished.reduce((n, g) => n + g.goals.length, 0),
    cards: event.games.reduce((n, g) => n + g.cards.length, 0),
  };
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function DeleteMatchDays() {
  const { events, removeEvent, error } = useMatchDay();
  const { refresh: refreshSquad } = useSquad();
  const { refresh: refreshCards } = useCards();
  const { refresh: refreshVale } = useValeContent();
  const [confirming, setConfirming] = useState<MatchDayEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirming) return;
    setDeleting(true);
    const ok = await removeEvent(confirming.id);
    setDeleting(false);
    setConfirming(null);
    if (ok) {
      refreshSquad();
      refreshCards();
      refreshVale();
    }
  }

  const newestFirst = [...events].reverse();
  const summary = confirming ? eventSummary(confirming) : null;

  return (
    <div>
      <h3 className="text-sm text-paper">Delete a match day</h3>
      <p className="mt-1 text-xs text-mist">
        Removes a match day and everything it counted towards: appearances, goals, assists and clean sheets, the
        cards and fines it logged, and the rating changes it made. If The Vale is showing it, the weekly awards fall
        back to the previous match day.
      </p>

      {error && <p className="mt-3 text-sm text-loss">{error}</p>}

      {newestFirst.length === 0 ? (
        <p className="mt-3 text-sm text-mist">No match days recorded.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-line overflow-hidden rounded-xl bg-ink">
          {newestFirst.map((event) => {
            const s = eventSummary(event);
            return (
              <li key={event.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm text-paper">
                    <span className="truncate">{event.title}</span>
                    {event.status === "live" && (
                      <span className="shrink-0 rounded-full bg-loss/15 px-2 py-0.5 text-[0.65rem] font-medium text-loss">
                        Live
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-mist">
                    {[event.venue, event.date].filter(Boolean).join(" · ")} · {plural(s.games, "game")} ·{" "}
                    {plural(s.goals, "goal")} · {plural(s.cards, "card")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirming(event)}
                  className="shrink-0 rounded-full bg-loss/15 px-3 py-1.5 text-xs font-semibold text-loss hover:bg-loss/25"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {confirming && summary && (
        <Modal title="Delete match day?" onClose={() => !deleting && setConfirming(null)}>
          <p className="text-sm text-paper">
            <span className="font-semibold">{confirming.title}</span>
            <span className="text-paper-dim"> — {[confirming.venue, confirming.date].filter(Boolean).join(", ")}</span>
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-paper-dim">
            <li>{plural(summary.games, "finished game")} and {plural(summary.goals, "goal")} come off every player's stats</li>
            <li>{plural(summary.cards, "card")} and their fines are removed</li>
            <li>Player ratings move back to where they were before it</li>
          </ul>
          <p className="mt-4 text-sm text-loss">This can't be undone.</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirming(null)}
              className="border border-ink-line px-5 py-2.5 text-sm text-paper-dim hover:text-paper disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="border border-loss bg-loss px-5 py-2.5 text-sm font-medium text-paper hover:bg-loss/80 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { loading } = useSettings();
  const canEdit = user?.staffRole !== "committee";
  // The squad passcode lives on the server (it's checked there at sign-in),
  // and isn't part of the public settings, so it's fetched on its own.
  const [passcode, setPasscode] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ passcode: string }>("/settings/passcode")
      .then((res) => setPasscode(res.passcode))
      .catch(() => setPasscode(""));
  }, []);

  const ready = !loading && passcode !== null;

  return (
    <div>
      <p className="text-sm text-paper-dim">Club configuration</p>
      <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">Settings</h1>
      <p className="mt-3 mb-8 max-w-2xl text-sm text-paper-dim">
        How the club runs — fines, match day rules, how ratings move and what updates automatically. Shared across
        every admin and device.
      </p>

      <SettingsForm key={ready ? "loaded" : "loading"} canEdit={canEdit} passcode={passcode ?? ""} />
    </div>
  );
}
