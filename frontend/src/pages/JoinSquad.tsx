import { Link } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import logoWhite from "../assets/brand/logo-white.png";
import { photos } from "../lib/photos";
import { apiFetch, apiFetchForm, ApiError } from "../lib/api";
import { resizeToBlob } from "../lib/media";

type Position = "GK" | "DEF" | "MID" | "FWD";

const positions: { value: Position; label: string }[] = [
  { value: "GK", label: "Goalkeeper" },
  { value: "DEF", label: "Defender" },
  { value: "MID", label: "Midfielder" },
  { value: "FWD", label: "Forward" },
];

const inputClass =
  "w-full border border-ink-line bg-ink px-4 py-3 text-paper outline-none transition-colors duration-300 focus:border-paper";

// Public sign-up page — the link the committee shares so players can add
// themselves to the squad. The squad passcode keeps strangers out.
export default function JoinSquad() {
  const stageRef = useRef<HTMLDivElement>(null);

  const [taken, setTaken] = useState<number[]>([]);
  const [passcode, setPasscode] = useState("");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState<Position>("MID");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState<{ name: string; number: number } | null>(null);

  useEffect(() => {
    apiFetch<{ data: { number: number }[] }>("/players?active_only=false")
      .then((res) => setTaken(res.data.map((p) => p.number)))
      .catch(() => {
        // Not essential — the server still rejects a taken number.
      });
  }, []);

  // Free the old preview's object URL whenever it's replaced or the page closes.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const numberTaken = number !== "" && taken.includes(Number(number));

  function choosePhoto(file: File | undefined) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for your photo.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    setPhoto(null);
    setPhotoPreview("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Multipart, so the photo travels with the sign-up in one request.
      const form = new FormData();
      form.append("passcode", passcode);
      form.append("name", name.trim());
      form.append("number", number);
      form.append("position", position);
      if (phone.trim()) form.append("phone", phone.trim());
      if (email.trim()) form.append("email", email.trim());
      if (photo) form.append("photo", await resizeToBlob(photo, 800), photo.name);

      await apiFetchForm("/players/join", form);
      setJoined({ name: name.trim(), number: Number(number) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the club server — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    stage.style.setProperty("--spot-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    stage.style.setProperty("--spot-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }

  return (
    <div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-5 py-16"
    >
      <img
        src={photos.grassrootsPitch}
        alt=""
        aria-hidden="true"
        className="duotone absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="duotone-wash pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink via-ink/80 to-ink" />
      <div className="floodlight-sweep pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <Link to="/" className="animate-hero-in relative z-10 mb-10 flex items-center gap-3">
        <img src={logoWhite} alt="Noisers FC crest" className="h-12 w-12" />
        <span className="font-display text-2xl tracking-wide text-paper">NOISERS FC</span>
        <span className="eq" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      </Link>

      <div className="animate-hero-in relative z-10 w-full max-w-md [animation-delay:100ms]">
        <div className="relative border border-ink-line bg-ink-raised/90 p-6 backdrop-blur-sm sm:p-8">
          <span className="corner corner-tl" />
          <span className="corner corner-tr" />
          <span className="corner corner-bl" />
          <span className="corner corner-br" />

          {joined ? (
            <>
              <p className="text-xs uppercase tracking-[0.3em] text-mist">Welcome aboard</p>
              <h1 className="reveal-text mt-2 font-display text-4xl text-paper">
                You're in, #{joined.number}
              </h1>
              <p className="mt-2 text-sm text-paper-dim">
                {joined.name} has been added to the Noisers squad. Use the same passcode to sign in
                to the player portal.
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <Link
                  to="/player-login"
                  className="shimmer-btn relative w-full overflow-hidden border border-paper bg-paper px-4 py-3 text-center text-sm font-medium text-ink transition-colors hover:bg-transparent hover:text-paper"
                >
                  <span className="relative z-10">Go to the player portal</span>
                </Link>
                <Link
                  to={`/squad/${joined.number}`}
                  className="w-full border border-ink-line px-4 py-3 text-center text-sm text-paper transition-colors hover:border-paper"
                >
                  See my profile
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.3em] text-mist">Squad sign-up</p>
              <h1 className="reveal-text mt-2 font-display text-4xl text-paper">Join the squad</h1>
              <p className="mt-2 text-sm text-paper-dim">
                Add yourself to the Noisers squad. You'll need the squad passcode from a committee
                member.
              </p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
                <div className="flex items-center gap-4">
                  <label className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-ink-line bg-ink transition-colors hover:border-paper focus-within:border-paper">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Your photo" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl text-mist" aria-hidden="true">+</span>
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
                    <p className="text-paper-dim">Profile photo (optional)</p>
                    <p className="mt-1 text-xs text-mist">A clear head-and-shoulders shot works best.</p>
                    {photo && (
                      <button
                        type="button"
                        onClick={clearPhoto}
                        className="mt-1 text-xs text-paper underline underline-offset-4 hover:text-paper-dim"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <label className="block">
                  <span className="text-sm text-paper-dim">Full name</span>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${inputClass} mt-2`}
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm text-paper-dim">Shirt number</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={99}
                      required
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-paper-dim">Position</span>
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value as Position)}
                      className={`${inputClass} mt-2`}
                    >
                      {positions.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {numberTaken ? (
                  <p className="-mt-3 text-xs text-loss">#{number} is already taken.</p>
                ) : (
                  taken.length > 0 && (
                    <p className="-mt-3 text-xs text-mist">
                      Taken: {[...taken].sort((a, b) => a - b).join(", ")}
                    </p>
                  )
                )}

                <label className="block">
                  <span className="text-sm text-paper-dim">Phone (optional)</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`${inputClass} mt-2`}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-paper-dim">Email (optional)</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputClass} mt-2`}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-paper-dim">Squad passcode</span>
                  <input
                    type="password"
                    autoComplete="off"
                    required
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className={`${inputClass} mt-2`}
                    placeholder="••••••••"
                  />
                </label>

                {error && <p className="text-sm text-loss">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting || numberTaken || !name.trim() || !number || !passcode}
                  className="shimmer-btn relative w-full overflow-hidden border border-paper bg-paper px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-transparent hover:text-paper disabled:opacity-60"
                >
                  <span className="relative z-10">{submitting ? "Signing you up…" : "Join the squad"}</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <p className="animate-hero-in relative z-10 mt-8 text-sm text-paper-dim [animation-delay:150ms]">
        Already in the squad?{" "}
        <Link to="/player-login" className="text-paper underline underline-offset-4 hover:text-paper-dim">
          Player login
        </Link>
      </p>

      <Link
        to="/"
        className="animate-hero-in relative z-10 mt-4 text-sm text-paper-dim transition-colors hover:text-paper [animation-delay:200ms]"
      >
        ← Back to the club site
      </Link>
    </div>
  );
}
