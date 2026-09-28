import { useEffect, useState, type FormEvent } from "react";
import Modal from "../admin/Modal";
import { apiFetchForm, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { resizeToBlob } from "../../lib/media";
import { isStockPhoto, positionLabels, type Player, type Position } from "../../lib/clubData";
import { useSquad, type ApiPlayer } from "../../lib/SquadContext";

// A player editing their own profile from the portal. Players have no
// accounts, so the save carries the squad passcode that opened the portal
// (asked for again only if it's missing or has since changed). Rating and
// membership stay with the committee.

const inputClass =
  "mt-1 w-full rounded-xl border border-ink-line bg-ink px-3 py-2.5 text-paper outline-none transition-colors focus:border-paper";
const labelClass = "block text-sm text-paper-dim";
const POSITIONS = Object.keys(positionLabels) as Position[];

export default function EditProfileModal({ player, onClose }: { player: Player; onClose: () => void }) {
  const { user, squadPasscode, rememberSquadPasscode } = useAuth();
  const { players, replacePlayer } = useSquad();
  const staff = !!user?.staffRole;

  const [name, setName] = useState(player.name);
  const [number, setNumber] = useState(player.number);
  const [position, setPosition] = useState<Position>(player.position);
  const [secondPosition, setSecondPosition] = useState<Position | null>(player.secondaryPosition ?? null);
  const [bio, setBio] = useState(player.bio ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const hasOwnPhoto = !isStockPhoto(player.photo);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);

  const [passcode, setPasscode] = useState("");
  const [askPasscode, setAskPasscode] = useState(!staff && !squadPasscode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const numberOwner = players.find((p) => p.number === number && p.id !== player.id);
  const shownPhoto = photoPreview || (hasOwnPhoto && !removePhoto ? player.photo : "");

  function choosePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for your photo.");
      return;
    }
    setError("");
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name.");
    if (!Number.isInteger(number) || number < 1 || number > 99) return setError("Your number must be from 1 to 99.");
    if (numberOwner) return setError(`Number ${number} is already taken by ${numberOwner.name}. Pick another number.`);
    const code = askPasscode ? passcode.trim() : (squadPasscode ?? "");
    if (!staff && !code) return setError("Type the squad passcode to save.");

    setError("");
    setSaving(true);
    try {
      // Multipart, so a new photo travels with the rest in one request.
      const form = new FormData();
      if (!staff) form.append("passcode", code);
      form.append("name", name.trim());
      form.append("number", String(number));
      form.append("position", position);
      form.append("secondary_position", secondPosition ?? "");
      form.append("bio", bio.trim());
      if (phone.trim()) form.append("phone", phone.trim());
      if (email.trim()) form.append("email", email.trim());
      if (photo) form.append("photo", await resizeToBlob(photo, 800), photo.name);
      else if (removePhoto) form.append("remove_photo", "1");

      const res = await apiFetchForm<{ data: ApiPlayer }>(`/players/${player.id}/profile`, form);
      replacePlayer(res.data);
      if (askPasscode && !staff) rememberSquadPasscode(code);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields.passcode) {
        // The passcode was changed since this phone signed in.
        setAskPasscode(true);
        setPasscode("");
      }
      setError(err instanceof ApiError ? err.message : "Couldn't reach the club server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit profile" onClose={() => !saving && onClose()}>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="flex items-center gap-4">
          <label className="join-photo cursor-pointer">
            {shownPhoto ? (
              <img src={shownPhoto} alt="Your photo" className="h-full w-full object-cover" />
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
            <p className="text-paper">{shownPhoto ? "Tap the photo to change it" : "Tap to add a photo"}</p>
            <p className="mt-1 text-xs text-mist">A clear head-and-shoulders shot works best.</p>
            {shownPhoto && (
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  setPhotoPreview("");
                  setRemovePhoto(hasOwnPhoto);
                }}
                className="mt-1 text-xs text-paper underline underline-offset-4 hover:text-paper-dim"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        <label className={labelClass}>
          Name
          <input type="text" autoComplete="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Shirt number
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              className={inputClass}
              value={Number.isNaN(number) ? "" : number}
              aria-invalid={!!numberOwner}
              onChange={(e) => setNumber(Number(e.target.value))}
            />
            {numberOwner && (
              <span className="mt-1 block text-xs text-loss" role="alert">
                Taken by {numberOwner.name}
              </span>
            )}
          </label>
          <label className={labelClass}>
            Position
            <select
              className={inputClass}
              value={position}
              onChange={(e) => {
                const next = e.target.value as Position;
                setPosition(next);
                if (secondPosition === next) setSecondPosition(null);
              }}
            >
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {positionLabels[pos]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={labelClass}>
          Second position (optional)
          <select
            className={inputClass}
            value={secondPosition ?? ""}
            onChange={(e) => setSecondPosition((e.target.value || null) as Position | null)}
          >
            <option value="">None</option>
            {POSITIONS.filter((pos) => pos !== position).map((pos) => (
              <option key={pos} value={pos}>
                {positionLabels[pos]}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          About you (optional)
          <textarea
            rows={3}
            maxLength={500}
            className={`${inputClass} resize-none`}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Favourite position, best goal, pre-match ritual…"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            New phone
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Leave blank to keep"
            />
          </label>
          <label className={labelClass}>
            New email
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Leave blank to keep"
            />
          </label>
        </div>
        <p className="-mt-2 text-xs text-mist">Only the committee sees your phone and email.</p>

        {askPasscode && !staff && (
          <label className={labelClass}>
            Squad passcode
            <input
              type="password"
              autoComplete="off"
              className={inputClass}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
          </label>
        )}

        <p className="min-h-5 text-sm text-loss" role="alert">
          {error}
        </p>

        <div className="sheet-actions flex justify-end gap-3 border-t border-ink-line pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full px-4 py-2 text-sm text-paper-dim ring-1 ring-ink-line hover:text-paper"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-paper px-5 py-2 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
