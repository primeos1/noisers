import { Link } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import logoWhite from "../assets/brand/logo-white.png";
import { apiFetchForm, ApiError } from "../lib/api";
import { resizeToBlob } from "../lib/media";
import { membershipLabels, positionLabels, type Membership, type Position } from "../lib/clubData";

// Public sign-up page — the link the committee shares so players can add
// themselves to the squad. Built around a live shirt that fills in as the
// player answers, one short step at a time (thumb-sized on a phone). The
// squad passcode, asked last, keeps strangers out.

const STEPS = [
  { title: "Who are you?", hint: "Your name goes on the back of the shirt." },
  { title: "Pick your number", hint: "Swipe the strip or use the arrows. Numbers can be shared." },
  { title: "Where do you play?", hint: "Tap your main position. Tap a second zone if you play there too." },
  { title: "Add a face", hint: "A photo and contact details help the committee reach you. All optional." },
  { title: "Squad passcode", hint: "Ask a committee member for it if you don't have it." },
] as const;

const LAST = STEPS.length - 1;
const NUMBER_WIDTH = 64; // px — one number in the swipe strip
const NUMBERS = Array.from({ length: 99 }, (_, i) => i + 1);
// Left to right the way the team attacks: keeper first, forwards last.
const ZONES: Position[] = ["GK", "DEF", "MID", "FWD"];

const SHIRT_PATH =
  "M62 22 L112 6 Q150 26 188 6 L238 22 L294 76 L256 116 L236 98 L236 306 Q150 316 64 306 L64 98 L44 116 L6 76 Z";

const inputClass =
  "w-full border-b-2 border-ink-line bg-transparent py-3 text-xl text-paper outline-none transition-colors duration-300 placeholder:text-mist/60 focus:border-paper";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** A tiny tap of feedback on phones that support it (Android). */
function buzz(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported — the visual change is enough.
  }
}

function trimColor(membership: Membership | "") {
  if (membership === "guest") return "var(--color-draw)";
  if (membership === "member") return "var(--color-win)";
  return "var(--color-mist)";
}

function Shirt({
  name,
  number,
  membership,
  flipped,
}: {
  name: string;
  number: number;
  membership: Membership | "";
  flipped: boolean;
}) {
  const trim = trimColor(membership);
  // Shirts carry the surname.
  const label = (name.trim().split(/\s+/).pop() ?? "").toUpperCase() || "YOUR NAME";
  const nameSize = Math.max(12, Math.min(34, (150 / label.length - 2) / 0.45));

  return (
    <div className="join-shirt-stage">
      <div className="join-shirt" data-flipped={flipped}>
        <svg className="join-shirt-face" viewBox="0 0 300 320" role="img" aria-label={`Shirt preview: ${label}, number ${number}`}>
          <defs>
            <pattern id="join-stripe-back" width="14" height="14" patternUnits="userSpaceOnUse">
              <rect width="2" height="14" fill="rgba(246,246,243,0.045)" />
            </pattern>
            <path id="join-name-arc" d="M76 106 Q150 80 224 106" fill="none" />
          </defs>
          <path d={SHIRT_PATH} fill="var(--color-ink-raised)" className="join-trim" style={{ stroke: trim }} strokeWidth="3" />
          <path d={SHIRT_PATH} fill="url(#join-stripe-back)" />
          <path d="M112 6 Q150 30 188 6" fill="none" className="join-trim" style={{ stroke: trim }} strokeWidth="7" strokeLinecap="round" />
          <path d="M6 76 L44 116 M294 76 L256 116" fill="none" className="join-trim" style={{ stroke: trim }} strokeWidth="9" />
          <text
            key={label}
            className="join-pop"
            fontFamily="var(--font-display)"
            fontWeight="800"
            fontSize={nameSize}
            letterSpacing="2"
            fill={name.trim() ? "var(--color-paper)" : "var(--color-mist)"}
            textAnchor="middle"
          >
            <textPath href="#join-name-arc" startOffset="50%">
              {label}
            </textPath>
          </text>
          <text
            key={number}
            className="join-pop"
            x="150"
            y="262"
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontWeight="900"
            fontSize="150"
            fill="var(--color-paper)"
          >
            {number}
          </text>
        </svg>

        <svg className="join-shirt-face join-shirt-front" viewBox="0 0 300 320" aria-hidden="true">
          <defs>
            <pattern id="join-stripe-front" width="14" height="14" patternUnits="userSpaceOnUse">
              <rect width="2" height="14" fill="rgba(246,246,243,0.045)" />
            </pattern>
          </defs>
          <path d={SHIRT_PATH} fill="var(--color-ink-raised)" style={{ stroke: trim }} strokeWidth="3" />
          <path d={SHIRT_PATH} fill="url(#join-stripe-front)" />
          <path d="M112 6 L150 46 L188 6" fill="none" style={{ stroke: trim }} strokeWidth="7" strokeLinejoin="round" />
          <path d="M6 76 L44 116 M294 76 L256 116" fill="none" style={{ stroke: trim }} strokeWidth="9" />
          <image href={logoWhite} x="178" y="74" width="46" height="46" />
          <text x="98" y="112" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="900" fontSize="40" fill="var(--color-paper)">
            {number}
          </text>
        </svg>
      </div>
    </div>
  );
}

function NumberStrip({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Start centred on the current number.
  useLayoutEffect(() => {
    stripRef.current?.scrollTo({ left: (value - 1) * NUMBER_WIDTH });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  function handleScroll() {
    const el = stripRef.current;
    if (!el) return;
    const n = Math.min(99, Math.max(1, Math.round(el.scrollLeft / NUMBER_WIDTH) + 1));
    if (n !== value) {
      onChange(n);
      buzz(4); // a click per number, like a dial
    }
  }

  function goTo(n: number) {
    const target = Math.min(99, Math.max(1, n));
    stripRef.current?.scrollTo({ left: (target - 1) * NUMBER_WIDTH, behavior: reducedMotion() ? "auto" : "smooth" });
    onChange(target);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      goTo(value - 1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      goTo(value + 1);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => goTo(value - 1)} className="join-nudge" aria-label="Lower number">
        ‹
      </button>
      <div className="relative min-w-0 flex-1">
        <div
          ref={stripRef}
          onScroll={handleScroll}
          onKeyDown={handleKey}
          tabIndex={0}
          role="slider"
          aria-label="Shirt number"
          aria-valuemin={1}
          aria-valuemax={99}
          aria-valuenow={value}
          className="join-strip join-strip-fade flex overflow-x-auto py-4 outline-none focus-visible:ring-2 focus-visible:ring-paper/60"
          style={{ paddingInline: `calc(50% - ${NUMBER_WIDTH / 2}px)` }}
        >
          {NUMBERS.map((n) => {
            const distance = Math.abs(n - value);
            return (
              <button
                key={n}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => goTo(n)}
                className="join-strip-number font-display font-black tabular-nums"
                style={{
                  width: NUMBER_WIDTH,
                  opacity: distance === 0 ? 1 : Math.max(0.18, 0.6 - distance * 0.12),
                  transform: `scale(${distance === 0 ? 1 : Math.max(0.55, 0.78 - distance * 0.06)})`,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        {/* The frame the chosen number sits in. */}
        <div
          className="pointer-events-none absolute inset-y-2 left-1/2 -translate-x-1/2 rounded-2xl border-2 border-paper/70"
          style={{ width: NUMBER_WIDTH + 8 }}
          aria-hidden="true"
        />
      </div>
      <button type="button" onClick={() => goTo(value + 1)} className="join-nudge" aria-label="Higher number">
        ›
      </button>
    </div>
  );
}

function PitchPicker({
  main,
  second,
  onChange,
}: {
  main: Position | null;
  second: Position | null;
  onChange: (main: Position | null, second: Position | null) => void;
}) {
  function tap(pos: Position) {
    buzz(10);
    if (pos === main) onChange(second, null); // dropping the main promotes the second
    else if (pos === second) onChange(main, null);
    else if (!main) onChange(pos, second);
    else onChange(main, pos); // a new second replaces the old one
  }

  return (
    <div className="relative mx-auto aspect-[3/2] w-full max-w-md overflow-hidden rounded-2xl bg-[#0f2a22]">
      <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <g fill="none" stroke="rgba(246,246,243,0.28)" strokeWidth="1.5">
          <rect x="6" y="6" width="288" height="188" rx="3" />
          <line x1="150" y1="6" x2="150" y2="194" />
          <circle cx="150" cy="100" r="24" />
          <rect x="6" y="52" width="40" height="96" />
          <rect x="6" y="78" width="14" height="44" />
          <rect x="254" y="52" width="40" height="96" />
          <rect x="280" y="78" width="14" height="44" />
        </g>
        <circle cx="150" cy="100" r="2.5" fill="rgba(246,246,243,0.4)" />
      </svg>
      <div className="absolute inset-0 grid grid-cols-4">
        {ZONES.map((pos) => {
          const role = pos === main ? "main" : pos === second ? "second" : undefined;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => tap(pos)}
              aria-pressed={!!role}
              aria-label={`${positionLabels[pos]}${role === "main" ? ", main position" : role === "second" ? ", second position" : ""}`}
              data-role={role}
              className="join-zone flex flex-col items-center justify-center gap-1 px-1"
            >
              <span className="font-display text-2xl font-extrabold text-paper sm:text-3xl">{pos}</span>
              <span className="text-[0.7rem] leading-tight text-paper-dim">{positionLabels[pos]}</span>
              <span className="join-zone-chip mt-1">{role === "main" ? "Main" : role === "second" ? "Second" : ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function JoinSquad() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");
  const [shaking, setShaking] = useState(false);
  const [nudge, setNudge] = useState("");

  const [name, setName] = useState("");
  // No default — each player says for themselves whether they're a member.
  const [membership, setMembership] = useState<Membership | "">("");
  const [number, setNumber] = useState(10);
  const [position, setPosition] = useState<Position | null>(null);
  const [secondPosition, setSecondPosition] = useState<Position | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [passcode, setPasscode] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState<{ id: number; name: string; number: number } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Free the old preview's object URL whenever it's replaced or the page closes.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  // Move screen readers (and keyboard focus) to each new step's question.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step, joined]);

  // What's still missing before the player can move on, per step.
  function missing(at: number): string {
    if (at === 0 && !name.trim()) return "Add your name first.";
    if (at === 0 && !membership) return "Pick Member or Guest member.";
    if (at === 2 && !position) return "Tap the position you play.";
    if (at === 4 && !passcode.trim()) return "Enter the squad passcode.";
    return "";
  }

  // Restart the shake without re-mounting the step, so a focused input (and a
  // phone's keyboard) stays put.
  function shake() {
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
  }

  function go(to: number) {
    setDirection(to > step ? "fwd" : "back");
    setNudge("");
    setError("");
    setStep(to);
  }

  function next() {
    const need = missing(step);
    if (need) {
      setNudge(need);
      shake();
      buzz(30);
      return;
    }
    if (step < LAST) go(step + 1);
    else submit();
  }

  function choosePhoto(file: File | undefined) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for your photo.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    buzz(10);
  }

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      // Multipart, so the photo travels with the sign-up in one request.
      const form = new FormData();
      form.append("passcode", passcode);
      form.append("name", name.trim());
      form.append("membership", membership);
      form.append("number", String(number));
      form.append("position", position ?? "");
      if (secondPosition) form.append("secondary_position", secondPosition);
      if (phone.trim()) form.append("phone", phone.trim());
      if (email.trim()) form.append("email", email.trim());
      if (photo) form.append("photo", await resizeToBlob(photo, 800), photo.name);

      const res = await apiFetchForm<{ data: { id: number; name: string; number: number } }>("/players/join", form);
      buzz(40);
      setJoined(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the club server. Check your connection and try again.");
      shake();
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    next();
  }

  const firstName = name.trim().split(/\s+/)[0];

  return (
    <div className="join-page relative flex min-h-dvh flex-col bg-ink text-paper md:flex-row">
      {/* Glow behind the shirt takes the membership colour. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="join-glow join-glow-member" style={{ opacity: membership === "member" ? 1 : 0 }} />
        <div className="join-glow join-glow-guest" style={{ opacity: membership === "guest" ? 1 : 0 }} />
        <div className="grain absolute inset-0" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-5 pt-5 md:absolute md:inset-x-0 md:top-0 md:px-10 md:pt-8">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoWhite} alt="Noisers FC" className="h-9 w-9" />
          <span className="font-display text-xl tracking-wide">Noisers FC</span>
        </Link>
        <Link to="/player-login" className="text-sm text-paper-dim underline-offset-4 hover:text-paper hover:underline">
          Already in? Log in
        </Link>
      </header>

      {/* Shirt: pinned above the questions on a phone, its own column on a wide screen. */}
      <section className="relative z-10 flex shrink-0 flex-col md:sticky md:top-0 md:h-dvh md:w-1/2 md:justify-center">
        <div className="mx-auto w-[min(62vw,15rem,30dvh)] pt-4 pb-2 md:w-[min(34vw,26rem)] md:pt-0">
          <Shirt name={name} number={number} membership={membership} flipped={!!joined} />
        </div>
      </section>

      <section className="relative z-10 flex flex-1 flex-col md:justify-center md:py-16 md:pr-10">
        {joined ? (
          <div className="join-step-fwd mx-auto w-full max-w-lg px-5 pb-10 text-center md:text-left">
            <h1 ref={headingRef} tabIndex={-1} className="font-display text-5xl font-extrabold leading-none outline-none md:text-6xl">
              You're in, {firstName || joined.name}
            </h1>
            <p className="mt-4 text-paper-dim">
              Number {joined.number} is on the squad list. Sign in to the player portal with the same passcode to see
              your stats after each match day.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/player-login" className="join-cta">
                Open the player portal
              </Link>
              <Link
                to={`/squad/${joined.id}`}
                className="rounded-full border border-ink-line px-6 py-4 text-center text-sm text-paper transition-colors hover:border-paper"
              >
                See my profile
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mx-auto flex w-full max-w-lg flex-1 flex-col md:flex-none">
            {/* Progress — the steps really are a sequence. */}
            <div className="px-5">
              <div className="flex gap-1.5" aria-hidden="true">
                {STEPS.map((_, i) => (
                  <span key={i} className="join-progress" data-done={i <= step} />
                ))}
              </div>
              <p className="mt-2 text-xs text-mist">
                Step {step + 1} of {STEPS.length}
              </p>
            </div>

            <div
              className={`flex-1 px-5 pt-4 pb-32 md:pb-8 ${shaking ? "join-shake" : ""}`}
              onAnimationEnd={(e) => {
                if (e.animationName === "join-shake") setShaking(false);
              }}
            >
              <div key={step} className={direction === "fwd" ? "join-step-fwd" : "join-step-back"}>
                <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl font-extrabold leading-none outline-none md:text-5xl">
                  {STEPS[step].title}
                </h1>
                <p className="mt-2 text-sm text-paper-dim">{STEPS[step].hint}</p>

                <div className="mt-6">
                  {step === 0 && (
                    <div className="space-y-6">
                      <label className="block">
                        <span className="sr-only">Full name</span>
                        <input
                          type="text"
                          autoComplete="name"
                          autoCapitalize="words"
                          enterKeyHint="next"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Full name"
                          className={inputClass}
                        />
                      </label>

                      <fieldset>
                        <legend className="text-sm text-paper-dim">Are you a club member?</legend>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {(Object.keys(membershipLabels) as Membership[]).map((value) => (
                            <label key={value} className="join-choice" data-tone={value} data-checked={membership === value}>
                              <input
                                type="radio"
                                name="membership"
                                value={value}
                                checked={membership === value}
                                onChange={() => {
                                  setMembership(value);
                                  setNudge("");
                                  buzz(10);
                                }}
                                className="sr-only"
                              />
                              <span className="join-choice-dot" aria-hidden="true" />
                              <span className="font-medium">{membershipLabels[value]}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  )}

                  {step === 1 && <NumberStrip value={number} onChange={setNumber} />}

                  {step === 2 && (
                    <PitchPicker
                      main={position}
                      second={secondPosition}
                      onChange={(m, s) => {
                        setPosition(m);
                        setSecondPosition(s);
                        setNudge("");
                      }}
                    />
                  )}

                  {step === 3 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <label className="join-photo">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Your photo" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-3xl text-mist" aria-hidden="true">
                              +
                            </span>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            aria-label="Profile photo"
                            onChange={(e) => {
                              choosePhoto(e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <div className="text-sm">
                          <p className="text-paper">{photo ? "Looking good." : "Tap to add a photo"}</p>
                          <p className="mt-1 text-xs text-mist">A clear head-and-shoulders shot works best.</p>
                          {photo && (
                            <button
                              type="button"
                              onClick={() => {
                                setPhoto(null);
                                setPhotoPreview("");
                              }}
                              className="mt-1 text-xs text-paper underline underline-offset-4 hover:text-paper-dim"
                            >
                              Remove photo
                            </button>
                          )}
                        </div>
                      </div>
                      <label className="block">
                        <span className="sr-only">Phone</span>
                        <input
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Phone (optional)"
                          className={inputClass}
                        />
                      </label>
                      <label className="block">
                        <span className="sr-only">Email</span>
                        <input
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email (optional)"
                          className={inputClass}
                        />
                      </label>
                    </div>
                  )}

                  {step === 4 && (
                    <label className="block">
                      <span className="sr-only">Squad passcode</span>
                      <input
                        type="password"
                        autoComplete="off"
                        enterKeyHint="done"
                        value={passcode}
                        onChange={(e) => {
                          setPasscode(e.target.value);
                          setNudge("");
                        }}
                        placeholder="Passcode"
                        className={`${inputClass} tracking-widest`}
                      />
                    </label>
                  )}
                </div>

                <p className="mt-4 min-h-5 text-sm text-loss" role="alert">
                  {error || nudge}
                </p>
              </div>
            </div>

            {/* Thumb bar — fixed to the bottom of a phone, inline on a wide screen. */}
            <div className="join-bar fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 px-5 pt-3 md:static md:mt-2 md:bg-none md:pt-0">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => go(step - 1)}
                  className="rounded-full border border-ink-line px-5 py-4 text-sm text-paper-dim transition-colors hover:border-paper hover:text-paper"
                >
                  Back
                </button>
              )}
              <button type="submit" disabled={submitting} className="join-cta flex-1">
                {step < LAST ? (step === 3 && !photo && !phone && !email ? "Skip for now" : "Next") : submitting ? "Joining…" : "Join the squad"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
