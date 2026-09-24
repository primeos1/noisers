import { useState, type ChangeEvent, type FormEvent } from "react";
import { useHomeContent, type HomeContentData } from "../../lib/HomeContentContext";
import ImageUploadField from "../../components/admin/ImageUploadField";
import { uploadMedia } from "../../lib/media";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const textareaClass = `${inputClass} min-h-[6rem]`;
const labelClass = "block text-sm text-paper-dim";

// Remounted (via `key`, below) once the real content arrives, so the form's
// local drafts start from live values without an effect syncing state after
// render — same pattern as AdminSettings.tsx's SettingsForm.
function HomeContentForm() {
  const { content, updateContent } = useHomeContent();
  const [hero, setHero] = useState(content.hero);
  const [story, setStory] = useState(content.story);
  const [atmosphere, setAtmosphere] = useState(content.atmosphere);
  const [matchday, setMatchday] = useState(content.matchday);
  const [footer, setFooter] = useState(content.footer);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const patch: Partial<Omit<HomeContentData, "stats" | "gallery">> = { hero, story, atmosphere, matchday, footer };
      await updateContent(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the Home page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-10 max-w-2xl space-y-12">
      <div>
        <h2 className="font-display text-2xl text-paper">Hero</h2>
        <p className="mt-1 text-sm text-paper-dim">The full-bleed banner at the top of the site.</p>
        <div className="mt-4 space-y-4">
          <label className={labelClass}>
            Eyebrow
            <input className={inputClass} value={hero.eyebrow} onChange={(e) => setHero({ ...hero, eyebrow: e.target.value })} />
          </label>
          <label className={labelClass}>
            Headline
            <input className={inputClass} value={hero.headline} onChange={(e) => setHero({ ...hero, headline: e.target.value })} />
          </label>
          <label className={labelClass}>
            Subtext
            <textarea className={textareaClass} value={hero.subtext} onChange={(e) => setHero({ ...hero, subtext: e.target.value })} />
          </label>
          <ImageUploadField
            label="Background image"
            value={hero.imageUrl}
            onChange={(url) => setHero({ ...hero, imageUrl: url })}
            maxDim={1800}
            previewClassName="duotone h-16 w-28 shrink-0 border border-ink-line object-cover"
          />
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-paper">Our story</h2>
        <div className="mt-4 space-y-4">
          <label className={labelClass}>
            Eyebrow
            <input className={inputClass} value={story.eyebrow} onChange={(e) => setStory({ ...story, eyebrow: e.target.value })} />
          </label>
          <label className={labelClass}>
            Headline
            <input className={inputClass} value={story.headline} onChange={(e) => setStory({ ...story, headline: e.target.value })} />
          </label>
          <label className={labelClass}>
            Paragraph 1
            <textarea className={textareaClass} value={story.paragraph1} onChange={(e) => setStory({ ...story, paragraph1: e.target.value })} />
          </label>
          <label className={labelClass}>
            Paragraph 2
            <textarea className={textareaClass} value={story.paragraph2} onChange={(e) => setStory({ ...story, paragraph2: e.target.value })} />
          </label>
          <ImageUploadField
            label="Image"
            value={story.imageUrl}
            onChange={(url) => setStory({ ...story, imageUrl: url })}
            maxDim={1200}
            previewClassName="duotone h-16 w-28 shrink-0 border border-ink-line object-cover"
          />
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-paper">Atmosphere break</h2>
        <p className="mt-1 text-sm text-paper-dim">The full-width photo break with a one-line caption.</p>
        <div className="mt-4 space-y-4">
          <label className={labelClass}>
            Caption
            <input className={inputClass} value={atmosphere.caption} onChange={(e) => setAtmosphere({ ...atmosphere, caption: e.target.value })} />
          </label>
          <ImageUploadField
            label="Image"
            value={atmosphere.imageUrl}
            onChange={(url) => setAtmosphere({ ...atmosphere, imageUrl: url })}
            maxDim={1600}
            previewClassName="duotone h-16 w-28 shrink-0 border border-ink-line object-cover"
          />
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-paper">How match day works</h2>
        <p className="mt-1 text-sm text-paper-dim">The explainer copy next to the latest match day teaser.</p>
        <div className="mt-4 space-y-4">
          <label className={labelClass}>
            Eyebrow
            <input className={inputClass} value={matchday.eyebrow} onChange={(e) => setMatchday({ ...matchday, eyebrow: e.target.value })} />
          </label>
          <label className={labelClass}>
            Headline
            <input className={inputClass} value={matchday.headline} onChange={(e) => setMatchday({ ...matchday, headline: e.target.value })} />
          </label>
          <label className={labelClass}>
            Body
            <textarea className={textareaClass} value={matchday.body} onChange={(e) => setMatchday({ ...matchday, body: e.target.value })} />
          </label>
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-paper">Footer</h2>
        <p className="mt-1 text-sm text-paper-dim">Shown on every page, site-wide.</p>
        <div className="mt-4 space-y-4">
          <label className={labelClass}>
            Tagline
            <input className={inputClass} value={footer.tagline} onChange={(e) => setFooter({ ...footer, tagline: e.target.value })} />
          </label>
          <label className={labelClass}>
            Copyright line
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-mist">© {new Date().getFullYear()}</span>
              <input className={`${inputClass} mt-0 flex-1`} value={footer.copyright} onChange={(e) => setFooter({ ...footer, copyright: e.target.value })} />
            </div>
            <span className="mt-1 block text-xs text-mist">The year is always added automatically — just the text after it.</span>
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save Home page copy"}
      </button>
    </form>
  );
}

function StatsEditor() {
  const { content, addStat, updateStat, removeStat } = useHomeContent();
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!newValue.trim() || !newLabel.trim()) return;
    setError("");
    try {
      await addStat({ value: newValue.trim(), label: newLabel.trim() });
      setNewValue("");
      setNewLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that stat.");
    }
  }

  return (
    <div className="mt-16 max-w-2xl border-t border-ink-line pt-10">
      <h2 className="font-display text-2xl text-paper">Stat tiles</h2>
      <p className="mt-1 text-sm text-paper-dim">
        The band of numbers under the hero (squad size is added automatically).
      </p>

      <div className="mt-4 space-y-2">
        {content.stats.map((stat) => (
          <div key={stat.id} className="flex items-center gap-3 border border-ink-line bg-ink-raised p-3">
            <input
              className={`${inputClass} mt-0 w-24`}
              value={stat.value}
              onChange={(e) => updateStat(stat.id, { value: e.target.value })}
            />
            <input
              className={`${inputClass} mt-0 flex-1`}
              value={stat.label}
              onChange={(e) => updateStat(stat.id, { label: e.target.value })}
            />
            <button type="button" onClick={() => removeStat(stat.id)} className="text-sm text-mist hover:text-loss">
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-3">
        <label className={labelClass}>
          Value
          <input className={`${inputClass} w-24`} value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="14" />
        </label>
        <label className={`${labelClass} flex-1`}>
          Label
          <input className={inputClass} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Wins this season" />
        </label>
        <button type="button" onClick={handleAdd} className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper">
          + Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-loss">{error}</p>}
    </div>
  );
}

function GalleryEditor() {
  const { content, addGalleryImage, removeGalleryImage } = useHomeContent();
  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function addUrl(url: string) {
    if (!url.trim()) return;
    setError("");
    try {
      await addGalleryImage({ imageUrl: url.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that image.");
    }
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const media = await uploadMedia(file, { maxDim: 1200 });
      await addGalleryImage({ imageUrl: media.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-16 max-w-2xl border-t border-ink-line pt-10">
      <h2 className="font-display text-2xl text-paper">Gallery strip</h2>
      <p className="mt-1 text-sm text-paper-dim">The "On the pitch" photo strip on the homepage.</p>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {content.gallery.map((image) => (
          <div key={image.id} className="group relative">
            <img src={image.imageUrl} alt={image.alt ?? ""} className="duotone h-24 w-full object-cover" />
            <button
              type="button"
              onClick={() => removeGalleryImage(image.id)}
              className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center border border-ink-line bg-ink/80 text-xs text-paper-dim hover:text-loss group-hover:flex"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-3">
        <label className="cursor-pointer border border-ink-line px-4 py-2 text-sm text-paper-dim hover:border-paper/60 hover:text-paper">
          {uploading ? "Uploading…" : "Upload image"}
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
        <label className={`${labelClass} flex-1`}>
          …or paste a URL
          <div className="mt-1 flex gap-2">
            <input className={`${inputClass} mt-0`} value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} />
            <button
              type="button"
              onClick={() => {
                addUrl(urlDraft);
                setUrlDraft("");
              }}
              className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper"
            >
              Add
            </button>
          </div>
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-loss">{error}</p>}
    </div>
  );
}

export default function AdminHomeContent() {
  const { loading } = useHomeContent();

  return (
    <div>
      <p className="text-sm text-paper-dim">Public site content</p>
      <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">Home page</h1>
      <p className="mt-3 max-w-2xl text-sm text-paper-dim">
        Every piece of copy and imagery on the homepage — changes go live immediately.
      </p>

      <HomeContentForm key={loading ? "loading" : "loaded"} />
      <StatsEditor />
      <GalleryEditor />
    </div>
  );
}
