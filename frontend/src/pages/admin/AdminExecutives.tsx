import { useState, type FormEvent } from "react";
import Modal from "../../components/admin/Modal";
import ImageUploadField from "../../components/admin/ImageUploadField";
import { useExecutives, type Executive, type ExecutiveInput } from "../../lib/ExecutivesContext";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const labelClass = "block text-sm text-paper-dim";
const iconButton =
  "flex h-8 w-8 items-center justify-center border border-ink-line text-sm text-paper-dim hover:border-paper/60 hover:text-paper disabled:cursor-not-allowed disabled:opacity-30";

function ExecutiveFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: Executive | null;
  onClose: () => void;
  onSubmit: (input: ExecutiveInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [photo, setPhoto] = useState(initial?.photo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !title.trim()) {
      setError("Add a name and a title.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), title: title.trim(), photo: photo.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that executive.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit executive" : "Add executive"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ImageUploadField
          label="Picture"
          value={photo}
          onChange={setPhoto}
          maxDim={1000}
          previewClassName="h-20 w-16 shrink-0 border border-ink-line object-cover"
        />

        <label className={labelClass}>
          Name
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tunde Bakare" />
        </label>

        <label className={labelClass}>
          Title
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chairman" />
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
            {saving ? "Saving…" : initial ? "Save changes" : "Add executive"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminExecutives() {
  const { executives, addExecutive, updateExecutive, removeExecutive, reorderExecutives } = useExecutives();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Executive | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Executive | null>(null);
  const [error, setError] = useState("");

  function move(index: number, by: -1 | 1) {
    const ids = executives.map((e) => e.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id!);
    setError("");
    reorderExecutives(ids).catch((err: Error) => setError(err.message));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-paper-dim">Public site content</p>
          <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">Executives</h1>
          <p className="mt-3 max-w-xl text-sm text-paper-dim">
            The committee shown on the public Executives page. Whoever is first is featured at the top — use the
            arrows to change the order.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper"
        >
          + Add executive
        </button>
      </div>

      {error && <p className="mt-6 text-sm text-loss">{error}</p>}

      {executives.length === 0 ? (
        <p className="mt-10 text-sm text-paper-dim">No executives yet — add the first one.</p>
      ) : (
        <ol className="mt-10 divide-y divide-ink-line border border-ink-line">
          {executives.map((exec, i) => (
            <li key={exec.id} className="flex items-center gap-4 p-3 md:p-4">
              <span className="w-6 shrink-0 text-center font-display text-lg text-mist">{i + 1}</span>
              {exec.photo ? (
                <img src={exec.photo} alt="" className="h-16 w-12 shrink-0 border border-ink-line object-cover" />
              ) : (
                <span className="flex h-16 w-12 shrink-0 items-center justify-center border border-ink-line bg-ink-raised font-display text-lg text-mist">
                  {exec.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-paper">{exec.name}</p>
                <p className="truncate text-sm text-paper-dim">
                  {exec.title}
                  {i === 0 && <span className="ml-2 text-xs text-win">Featured</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <button type="button" aria-label={`Move ${exec.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className={iconButton}>
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${exec.name} down`}
                  disabled={i === executives.length - 1}
                  onClick={() => move(i, 1)}
                  className={iconButton}
                >
                  ↓
                </button>
                <button type="button" aria-label={`Edit ${exec.name}`} onClick={() => setEditing(exec)} className={iconButton}>
                  ✎
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${exec.name}`}
                  onClick={() => setConfirmDelete(exec)}
                  className={`${iconButton} hover:text-loss`}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {adding && <ExecutiveFormModal initial={null} onClose={() => setAdding(false)} onSubmit={addExecutive} />}

      {editing && (
        <ExecutiveFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(input) => updateExecutive(editing.id, input)}
        />
      )}

      {confirmDelete && (
        <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)}>
          <div role="dialog" aria-modal="true" className="sheet md:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-paper">Remove executive</h2>
            <p className="mt-2 text-sm text-paper-dim">Remove {confirmDelete.name} from the Executives page?</p>
            <div className="sheet-actions mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  removeExecutive(target.id).catch((err: Error) => setError(err.message));
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
