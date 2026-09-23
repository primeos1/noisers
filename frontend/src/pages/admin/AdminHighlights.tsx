import { useState, type FormEvent } from "react";
import Modal from "../../components/admin/Modal";
import ImageUploadField from "../../components/admin/ImageUploadField";
import { categories, type HighlightItem, type MediaType } from "../../lib/highlights";
import { useHighlights, type NewHighlightInput } from "../../lib/HighlightsContext";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const labelClass = "block text-sm text-paper-dim";

function HighlightFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: HighlightItem | null;
  onClose: () => void;
  onSubmit: (input: NewHighlightInput) => Promise<void>;
}) {
  const [type, setType] = useState<MediaType>(initial?.type ?? "photo");
  const [mediaUrl, setMediaUrl] = useState(initial?.src ?? "");
  const [alt, setAlt] = useState(initial?.alt ?? "");
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories[0]);
  const [tall, setTall] = useState(initial?.tall ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mediaUrl.trim() || !caption.trim()) {
      setError("Add an image and a caption.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSubmit({ type, mediaUrl: mediaUrl.trim(), alt: alt.trim(), caption: caption.trim(), category, tall });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that highlight.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit highlight" : "Add highlight"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {(["photo", "video"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`border px-4 py-2 text-sm capitalize ${type === t ? "border-paper bg-ink" : "border-ink-line text-paper-dim hover:border-paper/40"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <ImageUploadField label={type === "video" ? "Video URL / thumbnail" : "Image"} value={mediaUrl} onChange={setMediaUrl} maxDim={1200} />

        <label className={labelClass}>
          Caption
          <input className={inputClass} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Idehen's second of the afternoon" />
        </label>

        <label className={labelClass}>
          Alt text
          <input className={inputClass} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image for screen readers" />
        </label>

        <label className={labelClass}>
          Category
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-paper-dim">
          <input type="checkbox" checked={tall} onChange={(e) => setTall(e.target.checked)} className="h-4 w-4 accent-paper" />
          Tall tile (spans two rows in the grid)
        </label>

        {error && <p className="text-sm text-loss">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-ink-line pt-4">
          <button type="button" onClick={onClose} className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="border border-paper bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Add highlight"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminHighlights() {
  const { highlights, addHighlight, updateHighlight, removeHighlight } = useHighlights();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<HighlightItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HighlightItem | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-paper-dim">Public site content</p>
          <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">Highlights</h1>
          <p className="mt-3 max-w-xl text-sm text-paper-dim">
            The photo and video gallery on the public Highlights page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper"
        >
          + Add highlight
        </button>
      </div>

      {highlights.length === 0 ? (
        <p className="mt-10 text-sm text-paper-dim">No highlights yet — add the first one.</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {highlights.map((item) => (
            <div key={item.id} className="group relative border border-ink-line">
              <img src={item.src} alt={item.alt} className="duotone h-32 w-full object-cover" />
              <div className="p-2">
                <p className="truncate text-xs text-paper-dim">{item.caption}</p>
                <p className="text-xs text-mist">{item.category}</p>
              </div>
              <div className="absolute right-2 top-2 hidden gap-2 group-hover:flex">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="flex h-7 w-7 items-center justify-center border border-ink-line bg-ink/80 text-xs text-paper-dim hover:text-paper"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(item)}
                  className="flex h-7 w-7 items-center justify-center border border-ink-line bg-ink/80 text-xs text-paper-dim hover:text-loss"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <HighlightFormModal initial={null} onClose={() => setAdding(false)} onSubmit={(input) => addHighlight(input)} />
      )}

      {editing && (
        <HighlightFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(input) => updateHighlight(editing.id, input)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-4 backdrop-blur" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm border border-ink-line bg-ink-raised p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-paper">Remove highlight</h2>
            <p className="mt-2 text-sm text-paper-dim">Remove "{confirmDelete.caption}"? This can't be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removeHighlight(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="border border-loss bg-loss px-4 py-2 text-sm font-medium text-paper hover:bg-transparent hover:text-loss"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
