import { useState, type FormEvent } from "react";
import Modal from "../../components/admin/Modal";
import ImageUploadField from "../../components/admin/ImageUploadField";
import {
  executiveGroups,
  useExecutives,
  type Executive,
  type ExecutiveGroup,
  type ExecutiveInput,
} from "../../lib/ExecutivesContext";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const labelClass = "block text-sm text-paper-dim";
const iconButton =
  "flex h-8 w-8 items-center justify-center border border-ink-line text-sm text-paper-dim hover:border-paper/60 hover:text-paper disabled:cursor-not-allowed disabled:opacity-30";

function ExecutiveFormModal({
  initial,
  defaultGroup,
  onClose,
  onSubmit,
}: {
  initial: Executive | null;
  defaultGroup: ExecutiveGroup;
  onClose: () => void;
  onSubmit: (input: ExecutiveInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [group, setGroup] = useState<ExecutiveGroup>(initial?.group ?? defaultGroup);
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
      await onSubmit({ name: name.trim(), title: title.trim(), group, photo: photo.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit member" : "Add member"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ImageUploadField
          label="Picture"
          value={photo}
          onChange={setPhoto}
          maxDim={1000}
          previewClassName="h-20 w-16 shrink-0 border border-ink-line object-cover"
        />

        <fieldset>
          <legend className={labelClass}>Section</legend>
          <div className="mt-1 grid grid-cols-3 border border-ink-line">
            {executiveGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={group === g.id}
                onClick={() => setGroup(g.id)}
                className={`px-2 py-2 text-xs md:text-sm ${
                  group === g.id ? "bg-paper font-medium text-ink" : "text-paper-dim hover:text-paper"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className={labelClass}>
          Name
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tunde Bakare" />
        </label>

        <label className={labelClass}>
          Title
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="President" />
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
            {saving ? "Saving…" : initial ? "Save changes" : "Add member"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminExecutives() {
  const { executives, addExecutive, updateExecutive, removeExecutive, reorderExecutives } = useExecutives();
  const [adding, setAdding] = useState<ExecutiveGroup | null>(null);
  const [editing, setEditing] = useState<Executive | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Executive | null>(null);
  const [error, setError] = useState("");

  /** Swaps a member with its neighbour in the same section, leaving everyone else where they are. */
  function move(exec: Executive, by: -1 | 1) {
    const peers = executives.filter((e) => e.group === exec.group);
    const neighbour = peers[peers.indexOf(exec) + by];
    if (!neighbour) return;
    const ids = executives.map((e) => e.id);
    const a = ids.indexOf(exec.id);
    const b = ids.indexOf(neighbour.id);
    [ids[a], ids[b]] = [ids[b]!, ids[a]!];
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
            The people on the public Executives page, in three sections. The first executive is featured at the top —
            use the arrows to change the order within a section.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding("executive")}
          className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper"
        >
          + Add member
        </button>
      </div>

      {error && <p className="mt-6 text-sm text-loss">{error}</p>}

      {executiveGroups.map((g) => {
        const members = executives.filter((e) => e.group === g.id);
        return (
          <section key={g.id} className="mt-10">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl text-paper">
                {g.label} <span className="text-mist">· {members.length}</span>
              </h2>
              <button type="button" onClick={() => setAdding(g.id)} className="text-sm text-paper-dim hover:text-paper">
                + Add
              </button>
            </div>

            {members.length === 0 ? (
              <p className="mt-3 border border-dashed border-ink-line p-4 text-sm text-paper-dim">
                Nobody here yet — this section stays hidden on the public page until you add someone.
              </p>
            ) : (
              <ol className="mt-3 divide-y divide-ink-line border border-ink-line">
                {members.map((exec, i) => (
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
                        {g.id === "executive" && i === 0 && <span className="ml-2 text-xs text-win">Featured</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        aria-label={`Move ${exec.name} up`}
                        disabled={i === 0}
                        onClick={() => move(exec, -1)}
                        className={iconButton}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${exec.name} down`}
                        disabled={i === members.length - 1}
                        onClick={() => move(exec, 1)}
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
          </section>
        );
      })}

      {adding && (
        <ExecutiveFormModal initial={null} defaultGroup={adding} onClose={() => setAdding(null)} onSubmit={addExecutive} />
      )}

      {editing && (
        <ExecutiveFormModal
          initial={editing}
          defaultGroup={editing.group}
          onClose={() => setEditing(null)}
          onSubmit={(input) => updateExecutive(editing.id, input)}
        />
      )}

      {confirmDelete && (
        <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)}>
          <div role="dialog" aria-modal="true" className="sheet md:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-paper">Remove member</h2>
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
