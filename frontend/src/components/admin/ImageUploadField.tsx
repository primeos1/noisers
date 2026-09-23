import { useState, type ChangeEvent } from "react";
import { uploadMedia } from "../../lib/media";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const labelClass = "block text-sm text-paper-dim";

/**
 * A single image field backed by the media library: upload a file (resized
 * and stored server-side via POST /media) or paste a URL directly. Used by
 * every admin form that holds one image — player photo, Home page sections,
 * Vale team photo, a Highlight's media.
 */
export default function ImageUploadField({
  label,
  value,
  onChange,
  maxDim,
  previewClassName = "duotone h-16 w-16 shrink-0 border border-ink-line object-cover",
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  maxDim?: number;
  previewClassName?: string;
}) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Image is too large — choose one under 5MB.");
      return;
    }

    setError("");
    setUploading(true);
    try {
      const media = await uploadMedia(file, { maxDim });
      onChange(media.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="mt-2 flex items-center gap-4">
        {value && <img src={value} alt="" className={previewClassName} />}
        <label className="cursor-pointer border border-ink-line px-4 py-2 text-sm text-paper-dim hover:border-paper/60 hover:text-paper">
          {uploading ? "Uploading…" : "Upload image"}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-loss">{error}</p>}
      <input
        type="text"
        className={`${inputClass} mt-3`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an image URL"
      />
    </div>
  );
}
